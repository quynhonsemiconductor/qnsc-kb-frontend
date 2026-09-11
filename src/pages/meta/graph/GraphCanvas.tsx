import { useEffect, useRef } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import { drag } from 'd3-drag'

export type GraphNode = { id: string; name: string; type: string; mention_count: number }
export type GraphLink = { id: string; source: string; target: string; relation: string }

type SimNode = GraphNode & SimulationNodeDatum
type SimLink = { id: string; relation: string; source: SimNode | string; target: SimNode | string }

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

function radiusFor(mentionCount: number): number {
  return 14 + Math.min(16, Math.sqrt(Math.max(mentionCount, 1)) * 5)
}

function endpointOf(value: SimNode | string): SimNode | undefined {
  return typeof value === 'string' ? undefined : value
}

export default function GraphCanvas({ nodes, links, centerId, selectedId, onSelectNode }: {
  nodes: GraphNode[]
  links: GraphLink[]
  centerId?: string | null
  selectedId?: string | null
  onSelectNode: (id: string) => void
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
      .map(link => ({ id: link.id, relation: link.relation, source: link.source, target: link.target }))

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
      .force('link', forceLink<SimNode, SimLink>(simLinks).id(d => d.id).distance(110).strength(0.5))
      .force('charge', forceManyBody().strength(-260))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimNode>(d => radiusFor(d.mention_count) + 20))

    const zoomGroup = select(zoomGroupEl)
    const linkSelection = zoomGroup.select<SVGGElement>('.graph-links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(simLinks, d => d.id)
      .join('line')
      .attr('stroke', 'rgb(var(--border))')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#graph-arrow)')

    const linkLabelSelection = zoomGroup.select<SVGGElement>('.graph-link-labels')
      .selectAll<SVGTextElement, SimLink>('text')
      .data(simLinks, d => d.id)
      .join('text')
      .attr('font-size', 9)
      .attr('fill', 'rgb(var(--muted-foreground))')
      .attr('text-anchor', 'middle')
      .text(d => d.relation)

    const nodeSelection = zoomGroup.select<SVGGElement>('.graph-nodes')
      .selectAll<SVGGElement, SimNode>('g.graph-node')
      .data(simNodes, d => d.id)
      .join(enter => {
        const group = enter.append('g').attr('class', 'graph-node').style('cursor', 'pointer')
        group.append('circle')
        group.append('text').attr('text-anchor', 'middle').attr('font-weight', 600)
        return group
      })

    nodeSelection.select<SVGCircleElement>('circle')
      .attr('r', d => radiusFor(d.mention_count))
      .attr('fill', d => colorFor(d.type))
      .attr('stroke', d => (d.id === selectedId ? 'rgb(var(--foreground))' : 'rgba(0,0,0,.15)'))
      .attr('stroke-width', d => (d.id === selectedId ? 3 : 1))

    nodeSelection.select<SVGTextElement>('text')
      .text(d => (d.name.length > 16 ? `${d.name.slice(0, 15)}…` : d.name))
      .attr('dy', d => radiusFor(d.mention_count) + 13)
      .attr('font-size', 10)
      .attr('fill', 'rgb(var(--foreground))')

    nodeSelection.on('click', (_event, d) => onSelectRef.current(d.id))
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
      linkSelection
        .attr('x1', d => endpointOf(d.source)?.x ?? 0)
        .attr('y1', d => endpointOf(d.source)?.y ?? 0)
        .attr('x2', d => endpointOf(d.target)?.x ?? 0)
        .attr('y2', d => endpointOf(d.target)?.y ?? 0)
      linkLabelSelection
        .attr('x', d => ((endpointOf(d.source)?.x ?? 0) + (endpointOf(d.target)?.x ?? 0)) / 2)
        .attr('y', d => ((endpointOf(d.source)?.y ?? 0) + (endpointOf(d.target)?.y ?? 0)) / 2)
      nodeSelection.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    const svgSelection = select(svgEl)
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', event => zoomGroup.attr('transform', event.transform))
    svgSelection.call(zoomBehavior)
    svgSelection.call(zoomBehavior.transform, zoomIdentity)

    return () => {
      window.clearTimeout(releaseTimer)
      simulation.stop()
      svgSelection.on('.zoom', null)
    }
  }, [nodes, links, centerId, selectedId])

  return (
    <div ref={containerRef} className="relative h-full min-h-[24rem] w-full overflow-hidden rounded-xl border border-border bg-surface">
      <svg ref={svgRef} className="h-full w-full touch-none">
        <defs>
          <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="rgb(var(--border))" />
          </marker>
        </defs>
        <g ref={zoomGroupRef}>
          <g className="graph-links" />
          <g className="graph-link-labels" />
          <g className="graph-nodes" />
        </g>
      </svg>
    </div>
  )
}
