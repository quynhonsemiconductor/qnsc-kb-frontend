import { useEffect, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { select, type Selection } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { drag } from 'd3-drag'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

export type GraphNode = { id: string; name: string; type: string; mention_count: number; description?: string | null }
export type GraphLink = { id: string; source: string; target: string; relation: string; description?: string | null }

type SimNode = GraphNode & SimulationNodeDatum
type SimLink = { id: string; relation: string; description?: string | null; source: SimNode | string; target: SimNode | string }

// A hand-picked qualitative palette, not the app's semantic tokens (success/warning/
// destructive etc.): those carry a specific meaning elsewhere in the product (danger,
// caution), and reusing them to mean "this node is a policy" would collide with that.
// Fixed hex rather than theme-reactive on purpose -- categorical markers read the same
// in both themes, the way a legend color does on any dashboard.
export const TYPE_COLORS: Record<string, string> = {
  person: '#6366f1',
  organization: '#0ea5e9',
  system: '#10b981',
  policy: '#f59e0b',
  location: '#ec4899',
  product: '#ef4444',
  concept: '#8b5cf6',
  other: '#64748b',
}

function colorFor(type: string): string {
  return TYPE_COLORS[type] || TYPE_COLORS.other
}

// Extraction relations come back lower-case verbs ("covers", "designed") -- fine as a
// database value, but a sentence fragment reads as an afterthought next to a proper
// noun in a tooltip or label. One capital letter is the entire fix.
function capitalize(value: string): string {
  return value.length ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

type TooltipState = { x: number; y: number; flipX: boolean; flipY: boolean; title: string; meta: string; lines: string[] }

// Lightens a fixed hex toward white -- used as the bright edge of each node's radial
// gradient, so a flat category dot reads as a glossy, lit sphere instead of a sticker.
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16)
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount)
  return `rgb(${mix((num >> 16) & 255)} ${mix((num >> 8) & 255)} ${mix(num & 255)})`
}

function radiusFor(mentionCount: number): number {
  return 15 + Math.min(19, Math.sqrt(Math.max(mentionCount, 1)) * 5.4)
}

function endpointOf(value: SimNode | string): SimNode | undefined {
  return typeof value === 'string' ? undefined : value
}

// `link.source`/`link.target` start as plain string ids and are mutated in place into
// live node references only once d3-force's link force initializes (inside the
// `forceSimulation(...).force('link', ...)` call below). Reading an id must work on
// EITHER shape, because the adjacency map below is built right after `simLinks` is
// constructed -- before that mutation has happened -- while the tick/opacity code
// further down runs after it. Using `endpointOf(...)?.id` (which assumes the resolved
// object shape) at the earlier point silently returns undefined for every link instead
// of erroring, which is what made the adjacency map end up empty.
function idOf(value: SimNode | string): string | undefined {
  return typeof value === 'string' ? value : value?.id
}

function pairKey(link: SimLink): string {
  const a = typeof link.source === 'string' ? link.source : link.source.id
  const b = typeof link.target === 'string' ? link.target : link.target.id
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

// Deterministic (not random) so the same edge always curves the same way across
// re-renders and reloads -- a stable diagram reads as designed, a jittery one reads as
// broken. Only the id decides the sign; the layout has no bearing on it.
function hashSign(id: string): 1 | -1 {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return hash % 2 === 0 ? 1 : -1
}

// A gentle, consistent bend on every edge -- the difference between a force diagram
// that looks like wiring and one that looks like a designed relationship map (the same
// trick Obsidian/Kumu/GitHub's dependency graph use). Parallel edges between the same
// two nodes fan out to opposite sides instead of drawing on top of one another.
function buildCurveOffset(simLinks: SimLink[]): (link: SimLink) => number {
  const buckets = new Map<string, string[]>()
  for (const link of simLinks) {
    const key = pairKey(link)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(link.id)
    else buckets.set(key, [link.id])
  }
  return (link: SimLink) => {
    const bucket = buckets.get(pairKey(link))!
    const index = bucket.indexOf(link.id)
    const side = index === 0 ? hashSign(link.id) : index % 2 === 1 ? -hashSign(link.id) : hashSign(link.id)
    return side * (1 + Math.floor(index / 2))
  }
}

// A quadratic path trimmed at both ends to each node's own radius, so the line floats
// between the circles' edges rather than the arrowhead vanishing under the target node
// (the old straight `<line>` ran center-to-center, which buried the marker entirely).
function curvedPath(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, bend: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const curvature = Math.min(Math.max(length * 0.15, 14), 64) * bend
  const cx = midX + (-dy / length) * curvature
  const cy = midY + (dx / length) * curvature

  const startAngle = Math.hypot(cx - x1, cy - y1) || 1
  const sx = x1 + ((cx - x1) / startAngle) * r1
  const sy = y1 + ((cy - y1) / startAngle) * r1
  const endAngle = Math.hypot(x2 - cx, y2 - cy) || 1
  const tx = x2 - ((x2 - cx) / endAngle) * r2
  const ty = y2 - ((y2 - cy) / endAngle) * r2

  return { d: `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`, labelX: 0.25 * sx + 0.5 * cx + 0.25 * tx, labelY: 0.25 * sy + 0.5 * cy + 0.25 * ty }
}

export default function GraphCanvas({ nodes, links, centerId, selectedId, onSelectNode, highlightIds }: {
  nodes: GraphNode[]
  links: GraphLink[]
  centerId?: string | null
  selectedId?: string | null
  onSelectNode: (id: string) => void
  // Node ids to highlight (e.g. a search match within the currently rendered
  // neighborhood). `undefined` means "no active search" -- every node stays full
  // opacity. An empty (non-undefined) set means "searched, nothing here matched" --
  // every node dims, rather than the search silently doing nothing. This never changes
  // `centerId`/re-fetches the neighborhood; it only dims what's already on screen.
  highlightIds?: Set<string>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomGroupRef = useRef<SVGGElement>(null)
  // The tick callback and the click handler both close over `onSelectNode`, but they
  // are attached once per effect run (per data change) -- a ref keeps them calling
  // whatever the latest prop is without re-running the whole simulation setup on
  // every parent re-render that only changed an unrelated callback identity.
  const onSelectRef = useRef(onSelectNode)
  onSelectRef.current = onSelectNode
  // Set once per data-change effect, read by the separate opacity effect below and by
  // the hover handlers attached in this one -- see its own comment for why a ref
  // (rather than duplicating the dimming logic in two places) is what keeps hovering a
  // node and an active search filter composable instead of fighting each other.
  const applyOpacityRef = useRef<(hoveredId: string | null) => void>(() => {})
  const zoomControlsRef = useRef<{
    svg: Selection<SVGSVGElement, unknown, null, undefined>
    behavior: ZoomBehavior<SVGSVGElement, unknown>
  } | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Container-relative, and flipped away from whichever edge is closer, so the card
  // reads next to the cursor without ever being clipped by the panel it lives in --
  // there is no portal here, so "clipped" would mean "invisible", not "scrolled to".
  const tooltipAt = (event: MouseEvent, title: string, meta: string, lines: string[]) => {
    const containerEl = containerRef.current
    if (!containerEl) return
    const rect = containerEl.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    setTooltip({ x, y, flipX: x > rect.width - 260, flipY: y > rect.height - 140, title, meta, lines: lines.filter(Boolean) })
  }

  useEffect(() => {
    const svgEl = svgRef.current
    const zoomGroupEl = zoomGroupRef.current
    const containerEl = containerRef.current
    if (!svgEl || !zoomGroupEl || !containerEl) return

    const width = containerEl.clientWidth || 640
    const height = containerEl.clientHeight || 420

    const simNodes: SimNode[] = nodes.map(node => ({ ...node }))
    const nodeById = new Map(simNodes.map(node => [node.id, node]))
    const simLinks: SimLink[] = links
      .filter(link => nodeById.has(link.source) && nodeById.has(link.target))
      .map(link => ({ id: link.id, relation: link.relation, description: link.description, source: link.source, target: link.target }))
    const curveOffset = buildCurveOffset(simLinks)

    const adjacency = new Map<string, Set<string>>()
    const linkedIds = (link: SimLink) => [idOf(link.source), idOf(link.target)] as const
    for (const link of simLinks) {
      const [a, b] = linkedIds(link)
      if (!a || !b) continue
      if (!adjacency.has(a)) adjacency.set(a, new Set())
      if (!adjacency.has(b)) adjacency.set(b, new Set())
      adjacency.get(a)!.add(b)
      adjacency.get(b)!.add(a)
    }

    // Seed the focal node in the middle so the first rendered frame is already legible
    // instead of d3's default random scatter, then release it once the layout has had a
    // moment to settle so the rest of the graph can still move freely around it.
    const center = centerId ? nodeById.get(centerId) : undefined
    if (center) {
      center.x = width / 2
      center.y = height / 2
      center.fx = width / 2
      center.fy = height / 2
    }
    const releaseTimer = window.setTimeout(() => {
      if (center) { center.fx = null; center.fy = null }
    }, 500)

    const simulation = forceSimulation(simNodes)
      .force('link', forceLink<SimNode, SimLink>(simLinks).id(d => d.id).distance(120).strength(0.45))
      .force('charge', forceManyBody().strength(-300))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimNode>(d => radiusFor(d.mention_count) + 24))

    const zoomGroup = select(zoomGroupEl)

    const linkSelection = zoomGroup.select<SVGGElement>('.graph-links')
      .selectAll<SVGPathElement, SimLink>('path')
      .data(simLinks, d => d.id)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', 'rgb(var(--muted-foreground) / .38)')
      .attr('stroke-width', 1.6)
      .attr('stroke-linecap', 'round')
      .attr('marker-end', 'url(#graph-arrow)')
      .style('transition', 'stroke .15s ease, stroke-width .15s ease, opacity .15s ease')

    // A fat, invisible twin of each line: the visible stroke is 1.6px, an unreasonably
    // small target to aim a cursor at, so hovering to read what a relationship MEANS
    // (see the tooltip below) needs a wider hit area than what actually gets painted.
    const linkHitSelection = zoomGroup.select<SVGGElement>('.graph-link-hitareas')
      .selectAll<SVGPathElement, SimLink>('path')
      .data(simLinks, d => d.id)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16)
      .style('cursor', 'help')

    const linkLabelGroups = zoomGroup.select<SVGGElement>('.graph-link-labels')
      .selectAll<SVGGElement, SimLink>('g.graph-link-label')
      .data(simLinks, d => d.id)
      .join(enter => {
        const g = enter.append('g').attr('class', 'graph-link-label').style('pointer-events', 'none')
        g.append('rect')
          .attr('rx', 5)
          .attr('fill', 'rgb(var(--surface-elevated) / .92)')
          .attr('stroke', 'rgb(var(--border-soft))')
          .attr('stroke-width', 1)
        g.append('text')
          .attr('font-size', 9.5)
          .attr('font-weight', 600)
          .attr('fill', 'rgb(var(--muted-foreground))')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
        return g
      })
      .style('transition', 'opacity .15s ease')

    linkLabelGroups.select<SVGTextElement>('text').text(d => capitalize(d.relation))
    linkLabelGroups.each(function labelSize() {
      const group = select(this)
      const textNode = group.select<SVGTextElement>('text').node()
      if (!textNode) return
      const box = textNode.getBBox()
      group.select<SVGRectElement>('rect')
        .attr('x', box.x - 5)
        .attr('y', box.y - 2.5)
        .attr('width', box.width + 10)
        .attr('height', box.height + 5)
    })

    const nodeSelection = zoomGroup.select<SVGGElement>('.graph-nodes')
      .selectAll<SVGGElement, SimNode>('g.graph-node')
      .data(simNodes, d => d.id)
      .join(enter => {
        const group = enter.append('g').attr('class', 'graph-node').style('cursor', 'pointer')
        group.append('circle').attr('class', 'node-halo').attr('fill', 'none')
        group.append('circle').attr('class', 'node-body')
        group.append('rect').attr('class', 'node-label-bg').attr('rx', 5)
          .attr('fill', 'rgb(var(--surface-elevated) / .9)')
        group.append('text').attr('class', 'node-label').attr('text-anchor', 'middle')
          .attr('font-weight', 700).attr('font-family', "'Manrope', sans-serif")
        return group
      })

    nodeSelection.select<SVGCircleElement>('circle.node-body')
      .attr('r', d => radiusFor(d.mention_count))
      .attr('fill', d => `url(#node-grad-${d.type in TYPE_COLORS ? d.type : 'other'})`)
      .attr('stroke', d => (d.id === selectedId ? colorFor(d.type) : 'rgb(var(--surface-elevated))'))
      .attr('stroke-width', d => (d.id === selectedId ? 3 : 2))
      .style('filter', d => {
        const ambient = 'drop-shadow(0 3px 6px rgb(var(--shadow) / .28))'
        if (d.id === selectedId) {
          const glow = colorFor(d.type)
          return `${ambient} drop-shadow(0 0 9px ${glow}) drop-shadow(0 0 3px ${glow})`
        }
        return ambient
      })

    // A faint ring one step outside the selected node's own stroke -- a second, softer
    // signal of "this is the current focus" that survives at a glance even when the
    // node itself is small, without adding another moving/animated element.
    nodeSelection.select<SVGCircleElement>('circle.node-halo')
      .attr('r', d => radiusFor(d.mention_count) + 5)
      .attr('stroke', d => (d.id === selectedId ? colorFor(d.type) : 'transparent'))
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '2 4')
      .attr('opacity', 0.6)

    nodeSelection.select<SVGTextElement>('text.node-label')
      .text(d => (d.name.length > 18 ? `${d.name.slice(0, 17)}…` : d.name))
      .attr('dy', d => radiusFor(d.mention_count) + 15)
      .attr('font-size', 10.5)
      .attr('fill', 'rgb(var(--foreground))')

    nodeSelection.each(function positionLabelBg() {
      const group = select(this)
      const textNode = group.select<SVGTextElement>('text.node-label').node()
      if (!textNode) return
      const box = textNode.getBBox()
      group.select<SVGRectElement>('rect.node-label-bg')
        .attr('x', box.x - 4)
        .attr('y', box.y - 1.5)
        .attr('width', box.width + 8)
        .attr('height', box.height + 3)
    })

    nodeSelection.on('click', (_event, d) => onSelectRef.current(d.id))
    nodeSelection
      .on('mouseenter', (event: MouseEvent, d) => {
        applyOpacityRef.current(d.id)
        const degree = adjacency.get(d.id)?.size ?? 0
        tooltipAt(
          event,
          d.name,
          `${capitalize(d.type)} · ${d.mention_count} mention${d.mention_count === 1 ? '' : 's'} · ${degree} connection${degree === 1 ? '' : 's'}`,
          [d.description || 'No description extracted for this entity yet.'],
        )
      })
      .on('mousemove', (event: MouseEvent, d) => {
        const degree = adjacency.get(d.id)?.size ?? 0
        tooltipAt(
          event,
          d.name,
          `${capitalize(d.type)} · ${d.mention_count} mention${d.mention_count === 1 ? '' : 's'} · ${degree} connection${degree === 1 ? '' : 's'}`,
          [d.description || 'No description extracted for this entity yet.'],
        )
      })
      .on('mouseleave', () => { applyOpacityRef.current(null); setTooltip(null) })
    linkHitSelection
      .on('mouseenter mousemove', (event: MouseEvent, d) => {
        const source = endpointOf(d.source)
        const target = endpointOf(d.target)
        if (!source || !target) return
        tooltipAt(event, capitalize(d.relation), `${source.name} → ${target.name}`, [d.description || ''])
      })
      .on('mouseleave', () => setTooltip(null))
    nodeSelection.call(
      drag<SVGGElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.2).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }),
    )

    simulation.on('tick', () => {
      // Computed once per link per tick and shared by the visible line, its invisible
      // (wider) hit-area twin, and the label -- this used to call `curvedPath` twice,
      // independently, for the same link.
      const paths = new Map<string, ReturnType<typeof curvedPath>>()
      for (const link of simLinks) {
        const source = endpointOf(link.source)
        const target = endpointOf(link.target)
        if (!source || !target) continue
        paths.set(link.id, curvedPath(
          source.x ?? 0, source.y ?? 0, target.x ?? 0, target.y ?? 0,
          radiusFor(source.mention_count), radiusFor(target.mention_count),
          curveOffset(link),
        ))
      }
      linkSelection.attr('d', d => paths.get(d.id)?.d ?? '')
      linkHitSelection.attr('d', d => paths.get(d.id)?.d ?? '')
      linkLabelGroups.attr('transform', d => {
        const path = paths.get(d.id)
        return path ? `translate(${path.labelX},${path.labelY})` : ''
      })
      nodeSelection.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    const svgSelection = select(svgEl)
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', event => {
        zoomGroup.attr('transform', event.transform)
        setZoomPercent(Math.round(event.transform.k * 100))
      })
    svgSelection.call(zoomBehavior)
    svgSelection.call(zoomBehavior.transform, zoomIdentity)
    zoomControlsRef.current = { svg: svgSelection, behavior: zoomBehavior }

    // Centralized so both the hover handlers above and the search-highlight effect
    // below drive the exact same opacity rule -- redefined on every data change so it
    // always closes over the current selections rather than stale ones from a
    // previous render.
    applyOpacityRef.current = (hoveredId: string | null) => {
      const active = hoveredId ? new Set([hoveredId, ...(adjacency.get(hoveredId) ?? [])]) : null
      const isDimmed = (id: string) => {
        if (active) return !active.has(id)
        return !!highlightIds && !highlightIds.has(id)
      }
      nodeSelection.style('opacity', d => (isDimmed(d.id) ? 0.15 : 1))
      linkSelection
        .attr('stroke', d => {
          const [a, b] = linkedIds(d)
          const touchesHover = hoveredId && (a === hoveredId || b === hoveredId)
          return touchesHover ? 'rgb(var(--primary) / .75)' : 'rgb(var(--muted-foreground) / .38)'
        })
        .attr('stroke-width', d => {
          const [a, b] = linkedIds(d)
          return hoveredId && (a === hoveredId || b === hoveredId) ? 2.4 : 1.6
        })
        .style('opacity', d => {
          const [a, b] = linkedIds(d)
          return (a && isDimmed(a)) && (b && isDimmed(b)) ? 0.12 : 1
        })
      linkLabelGroups.style('opacity', d => {
        const [a, b] = linkedIds(d)
        return (a && isDimmed(a)) && (b && isDimmed(b)) ? 0.12 : 1
      })
    }
    applyOpacityRef.current(null)

    return () => {
      window.clearTimeout(releaseTimer)
      simulation.stop()
      svgSelection.on('.zoom', null)
      setTooltip(null)
    }
  }, [nodes, links, centerId, selectedId])

  // Separate from the layout effect above on purpose: dimming for a search match must
  // never restart the simulation or re-fetch anything, or every keystroke would jolt the
  // whole diagram. This only calls the shared opacity function the effect above wired
  // up, so a search match and a hover never fight over which one owns the dimming.
  useEffect(() => {
    applyOpacityRef.current(null)
  }, [nodes, links, highlightIds])

  // Not `.transition()`: that needs d3-transition's type augmentation of Selection,
  // which is not a dependency here (and isn't worth adding for a button click) --
  // `.call()` on a plain selection still applies the zoom immediately, just without an
  // eased animation between the two states.
  const zoomBy = (factor: number) => {
    const controls = zoomControlsRef.current
    if (!controls) return
    controls.svg.call(controls.behavior.scaleBy, factor)
  }
  const resetZoom = () => {
    const controls = zoomControlsRef.current
    if (!controls) return
    controls.svg.call(controls.behavior.transform, zoomIdentity)
  }

  return (
    <div
      ref={containerRef}
      className="graph-canvas-surface relative h-full min-h-[24rem] w-full overflow-hidden rounded-xl border border-border"
    >
      <svg ref={svgRef} className="h-full w-full touch-none">
        <defs>
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <radialGradient key={type} id={`node-grad-${type}`} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor={lighten(color, 0.5)} />
              <stop offset="100%" stopColor={color} />
            </radialGradient>
          ))}
          <marker id="graph-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0.5 L9,5 L0,9.5 L2.5,5 z" fill="rgb(var(--muted-foreground) / .6)" />
          </marker>
        </defs>
        <g ref={zoomGroupRef}>
          <g className="graph-links" />
          <g className="graph-link-hitareas" />
          <g className="graph-link-labels" />
          <g className="graph-nodes" />
        </g>
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 w-60 rounded-xl border border-border bg-surface-elevated/98 p-3 shadow-[0_14px_32px_rgb(var(--shadow)/.26)]"
          style={{
            left: tooltip.flipX ? undefined : tooltip.x + 16,
            right: tooltip.flipX ? `calc(100% - ${tooltip.x - 16}px)` : undefined,
            top: tooltip.flipY ? undefined : tooltip.y + 16,
            bottom: tooltip.flipY ? `calc(100% - ${tooltip.y - 16}px)` : undefined,
          }}
        >
          <p className="font-display text-body-sm font-bold leading-snug text-foreground">{tooltip.title}</p>
          <p className="mt-1 text-caption font-semibold text-muted-foreground">{tooltip.meta}</p>
          {tooltip.lines.map((line, index) => (
            <p key={index} className="mt-1.5 text-caption leading-relaxed text-muted-foreground">{line}</p>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-xl border border-border bg-surface-elevated/95 p-1 shadow-[0_8px_20px_rgb(var(--shadow)/.16)]">
        <button type="button" title="Zoom in" onClick={() => zoomBy(1.35)} className="pointer-events-auto inline-grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-soft hover:text-foreground">
          <ZoomIn size={15} />
        </button>
        <span className="min-w-[3ch] select-none text-center text-caption font-semibold tabular-nums text-muted-foreground">{zoomPercent}%</span>
        <button type="button" title="Zoom out" onClick={() => zoomBy(1 / 1.35)} className="pointer-events-auto inline-grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-soft hover:text-foreground">
          <ZoomOut size={15} />
        </button>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <button type="button" title="Reset view" onClick={resetZoom} className="pointer-events-auto inline-grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-soft hover:text-foreground">
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  )
}
