import { ICONS, type IconName } from './icons';

/** Biểu tượng trang trí (aria-hidden). Nút chỉ có biểu tượng phải tự có `aria-label`. */
export function Icon({ name, fill = false }: { name: IconName; fill?: boolean }) {
  return (
    <i
      className={fill ? 'ic fill' : 'ic'}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24">${ICONS[name]}</svg>` }}
    />
  );
}
