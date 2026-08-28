import { BottomNav } from './BottomNav';

export function AppScreen({ children, nav = true, className = '' }) {
  return (
    <div className={`app-shell flex flex-col ${className}`}>
      <div className="flex-1 pb-4">{children}</div>
      {nav ? <BottomNav /> : null}
    </div>
  );
}
