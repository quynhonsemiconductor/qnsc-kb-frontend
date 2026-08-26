/**
 * The real QNSC mark, from Logo_QNSC_v31 (Option B, Mars palette).
 *
 * Inlined as SVG rather than loaded from /brand-mark.svg: it is ~1 KB, it appears in
 * the sidebar on every route and on the login screen, and inlining means it is present
 * in the first paint instead of arriving a request later and shifting the header.
 *
 * The mark keeps its own colours on purpose. Mars Copper is a 5% accent in the brand
 * spec, so it is not wired to the theme's `--primary` — a logo that changes hue with a
 * theme toggle is not the logo. It is legible on both the light and dark surfaces the
 * app uses because the die is copper on a transparent ground with a Soft White ring.
 */

const COPPER = '#B4432F'
const SOFT_WHITE = '#F3F5F7'

export function BrandMarkGlyph({ className = '', title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M100.978 7.11111H27.0222C16.0256 7.11111 7.11111 16.0256 7.11111 27.0222V100.978C7.11111 111.974 16.0256 120.889 27.0222 120.889H100.978C111.974 120.889 120.889 111.974 120.889 100.978V27.0222C120.889 16.0256 111.974 7.11111 100.978 7.11111Z"
        fill={COPPER}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M31.2889 18.4889H96.7111C105.244 18.4889 109.511 22.7556 109.511 31.2889V89.6L89.6 109.511H31.2889C22.7556 109.511 18.4889 105.244 18.4889 96.7111V31.2889C18.4889 22.7556 22.7556 18.4889 31.2889 18.4889ZM41.9556 33.4222H86.0444C91.7333 33.4222 94.5778 36.2667 94.5778 41.9556V83.2L83.2 94.5778H41.9556C36.2667 94.5778 33.4222 91.7333 33.4222 86.0444V41.9556C33.4222 36.2667 36.2667 33.4222 41.9556 33.4222Z"
        fill={SOFT_WHITE}
      />
      <path
        d="M14.9333 19.5555C17.4861 19.5555 19.5556 17.4861 19.5556 14.9333C19.5556 12.3805 17.4861 10.3111 14.9333 10.3111C12.3806 10.3111 10.3111 12.3805 10.3111 14.9333C10.3111 17.4861 12.3806 19.5555 14.9333 19.5555Z"
        fill={SOFT_WHITE}
      />
    </svg>
  )
}

/**
 * The primary lockup: mark, then QNSC over a letterspaced SEMICONDUCTOR.
 *
 * The wordmark is text, not the supplied lockup SVG. Logo_QNSC_LockupPrimary.svg is a
 * spec-board export — it carries a baked-in Deep Navy card and a Soft White page rect,
 * so dropping it into the light theme would paste a dark rectangle into the header.
 * Setting the two words in the app's own display face reproduces the lockup, inherits
 * the theme's foreground colour, and stays crisp at any size.
 */
export default function BrandMark({
  showWordmark = true,
  className = '',
  glyphClassName = 'h-10 w-10',
}: {
  showWordmark?: boolean
  className?: string
  glyphClassName?: string
}) {
  return (
    <span className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <BrandMarkGlyph className={`${glyphClassName} shrink-0`} title="QNSC" />
      {showWordmark ? (
        <span className="min-w-0 leading-none">
          <span className="block font-display text-body-lg font-extrabold tracking-tight text-foreground">QNSC</span>
          <span className="mt-1 block text-caption font-semibold uppercase tracking-[.28em] text-muted-foreground">
            Semiconductor
          </span>
        </span>
      ) : null}
    </span>
  )
}
