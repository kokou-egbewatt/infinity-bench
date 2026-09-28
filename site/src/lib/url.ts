const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path = '/'): string {
  return `${base}/${path.replace(/^\//, '')}`;
}

export function stripBase(pathname: string): string {
  const p = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return p.replace(/\/$/, '') || '/';
}
