interface BrokerSymbolImageProps {
  symbol: string;
  iconUrl?: string | null;
  size?: number;
  className?: string;
}

export default function BrokerSymbolImage({
  symbol,
  iconUrl,
  size = 36,
  className = "",
}: BrokerSymbolImageProps) {
  const initial = symbol.charAt(0).toUpperCase();
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300 ${className}`}
      style={{ width: size, height: size }}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={symbol}
          className="h-full w-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
