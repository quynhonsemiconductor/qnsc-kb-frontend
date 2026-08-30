import { Check, Minus } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageProvider'
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, checkPassword, type PasswordStrength } from '../../lib/password'

const strengthMeta: Record<PasswordStrength, { key: string; width: string; bar: string; text: string }> = {
  weak: { key: 'auth.pwStrengthWeak', width: 'w-1/3', bar: 'bg-destructive', text: 'text-destructive' },
  fair: { key: 'auth.pwStrengthFair', width: 'w-2/3', bar: 'bg-warning', text: 'text-warning' },
  strong: { key: 'auth.pwStrengthStrong', width: 'w-full', bar: 'bg-success', text: 'text-success' },
}

function Rule({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? 'text-success' : 'text-muted-foreground'}`}>
      <span aria-hidden="true">{met ? <Check size={13} /> : <Minus size={13} />}</span>
      {children}
    </li>
  )
}

/**
 * Live policy feedback shared by the accept-invite, reset, and change-password forms.
 * `confirmation` is optional so the change-password form can reuse it without a second
 * copy of the match rule.
 */
export function PasswordRules({ password, confirmation }: { password: string; confirmation?: string }) {
  const { t } = useLanguage()
  const check = checkPassword(password)
  const meta = strengthMeta[check.strength]
  // Nothing typed yet: show the rules as a plain checklist rather than flagging an empty
  // field as weak the moment the form renders.
  const showStrength = password.length > 0

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
          {showStrength && <div className={`h-full rounded-full transition-all duration-300 ${meta.width} ${meta.bar}`} />}
        </div>
        {showStrength && <span className={`text-caption font-bold uppercase tracking-[.14em] ${meta.text}`}>{t(meta.key)}</span>}
      </div>
      <ul className="grid gap-1 text-body-sm sm:grid-cols-2">
        <Rule met={check.meetsMinLength}>{t('auth.pwMinRule', { min: PASSWORD_MIN_LENGTH })}</Rule>
        <Rule met={showStrength && check.withinMaxBytes}>{t('auth.pwByteRule', { used: check.byteLength, max: PASSWORD_MAX_BYTES })}</Rule>
        {confirmation !== undefined && (
          <Rule met={password.length > 0 && password === confirmation}>{t('auth.pwMatchRule')}</Rule>
        )}
      </ul>
    </div>
  )
}
