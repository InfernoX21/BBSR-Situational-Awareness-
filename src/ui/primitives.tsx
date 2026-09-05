/**
 * ARKA form and action primitives.
 *
 * Every interactive control in the platform is one of these. A page that needs a
 * button that looks slightly different should be asking for a new *variant*
 * here, not writing its own — the previous interface had eleven button
 * treatments and no two agreed on height.
 *
 * These are thin: the visual language lives in the `ark-*` classes in
 * `index.css`, and these components exist to give it a typed API, correct
 * defaults for accessibility, and one place to fix a mistake.
 */

import { memo, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from './cx';

// --- Button ------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'outline' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'ark-btn-primary',
  secondary: 'ark-btn-secondary',
  quiet: 'ark-btn-quiet',
  outline: 'ark-btn-outline',
  danger: 'ark-btn-danger',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  xs: 'ark-btn-xs',
  sm: 'ark-btn-sm',
  md: '',
  lg: 'ark-btn-lg',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner and disables the control. */
  busy?: boolean;
  /** Icon element, placed before the label. */
  icon?: ReactNode;
  /** Icon element, placed after the label. */
  trailing?: ReactNode;
  block?: boolean;
  className?: string;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  busy = false,
  icon,
  trailing,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={cx('ark-btn', BUTTON_VARIANT[variant], BUTTON_SIZE[size], block && 'w-full', className)}
      {...rest}
    >
      {busy ? <Loader2 size={13} className="ark-spin" aria-hidden /> : icon}
      {children}
      {trailing}
    </button>
  );
}

// --- Icon button -------------------------------------------------------------

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  /** Required: an icon-only control needs an accessible name. */
  label: string;
  icon: ReactNode;
  active?: boolean;
  /** Shown as a native tooltip. Defaults to `label`. */
  hint?: string;
  className?: string;
}

export function IconButton({ label, icon, active = false, hint, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      title={hint ?? label}
      className={cx('ark-icon-btn', active && 'is-active', className)}
      {...rest}
    >
      {icon}
    </button>
  );
}

// --- Text input --------------------------------------------------------------

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  /** Icon rendered inside the field, on the leading edge. */
  icon?: ReactNode;
  /** Element rendered inside the field, on the trailing edge. */
  trailing?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
  /** Wrapper class, when the field is composed into a layout. */
  wrapClassName?: string;
}

export function Input({ icon, trailing, inputRef, className, wrapClassName, ...rest }: InputProps) {
  if (!icon && !trailing) {
    return <input ref={inputRef} className={cx('ark-input', className)} {...rest} />;
  }
  return (
    <div className={cx('relative flex items-center', wrapClassName)}>
      {icon && (
        <span className="absolute left-2 flex items-center text-ink-faint pointer-events-none" aria-hidden>
          {icon}
        </span>
      )}
      <input
        ref={inputRef}
        className={cx('ark-input', icon && 'pl-7', trailing && 'pr-7', className)}
        {...rest}
      />
      {trailing && <span className="absolute right-1.5 flex items-center">{trailing}</span>}
    </div>
  );
}

// --- Select ------------------------------------------------------------------

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'onChange' | 'value' | 'children'> {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onValueChange: (value: T) => void;
  className?: string;
}

export function Select<T extends string = string>({
  value,
  options,
  onValueChange,
  className,
  ...rest
}: SelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(event) => onValueChange(event.target.value as T)}
      className={cx('ark-select', className)}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// --- Textarea ----------------------------------------------------------------

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  textareaRef?: Ref<HTMLTextAreaElement>;
  className?: string;
}

export function Textarea({ textareaRef, className, ...rest }: TextareaProps) {
  return <textarea ref={textareaRef} className={cx('ark-textarea', className)} {...rest} />;
}

// --- Toggle ------------------------------------------------------------------

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name. Required — a bare switch tells a screen reader nothing. */
  label: string;
  disabled?: boolean;
  /** Rendered next to the switch. Omit for a switch inside a labelled row. */
  showLabel?: boolean;
  hint?: string;
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled, showLabel = false, hint, className }: ToggleProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      disabled={disabled}
      title={hint}
      onClick={() => onChange(!checked)}
      className={cx('ark-toggle', className)}
    />
  );
  if (!showLabel) return control;
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      {control}
      <span className="text-[12px] text-ink-muted">{label}</span>
    </label>
  );
}

// --- Chip --------------------------------------------------------------------

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  active?: boolean;
  icon?: ReactNode;
  /** Trailing count, right-aligned in a monospace slot. */
  count?: number | null;
  className?: string;
}

export function Chip({ active = false, icon, count, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button type={type} aria-pressed={active} className={cx('ark-chip', className)} {...rest}>
      {icon}
      {children}
      {count != null && <span className="ark-mono text-[10px] opacity-70">{count}</span>}
    </button>
  );
}

// --- Segmented control -------------------------------------------------------

export interface SegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode; hint?: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  /** Accessible group name. */
  label: string;
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, label, className }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cx('ark-segment', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          title={option.hint ?? option.label}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

// --- Range slider ------------------------------------------------------------

export interface RangeProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  /** Formats the current value for the readout. */
  format?: (value: number) => string;
  disabled?: boolean;
}

export function Range({ value, min, max, step = 1, onChange, label, format, disabled }: RangeProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="ark-label">{label}</span>
        <span className="ark-mono text-[11px] text-ink">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        className="ark-range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

// --- Keyboard hint -----------------------------------------------------------

/** Renders a shortcut as individual keycaps: `Kbd keys={['Ctrl', 'K']}`. */
export const Kbd = memo(function Kbd({ keys }: { keys: readonly string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {keys.map((key) => (
        <kbd key={key} className="ark-kbd">
          {key}
        </kbd>
      ))}
    </span>
  );
});

// --- Loading affordances -----------------------------------------------------

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cx('ark-spin', className)} aria-hidden />;
}

/** Placeholder block for content that is genuinely still loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('ark-skeleton', className)} aria-hidden />;
}
