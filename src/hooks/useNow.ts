import { useEffect, useState } from 'react';

/** Giờ hiện tại, cập nhật định kỳ để khung giờ / ngày tự chuyển khi app để mở lâu. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
