import clsx from 'classnames';

export function cn(...inputs: (string | object | undefined | null | false)[]): string {
  return clsx(inputs);
}