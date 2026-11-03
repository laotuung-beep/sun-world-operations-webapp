interface Props {
  name?: string;
  photoURL?: string;
  size?: number;
}

export function Avatar({ name, photoURL, size = 36 }: Props) {
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const style = { width: size, height: size };
  if (photoURL) {
    return <img src={photoURL} alt="" referrerPolicy="no-referrer" className="rounded-full object-cover shrink-0" style={style} />;
  }
  return (
    <span
      className="rounded-full bg-slate-200 text-slate-600 font-bold grid place-items-center shrink-0"
      style={{ ...style, fontSize: size * 0.38 }}
    >
      {initials || '?'}
    </span>
  );
}
