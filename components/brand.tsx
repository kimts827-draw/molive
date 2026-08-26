import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand${compact ? " brand-compact" : ""}`} href="/" aria-label="MOLIVE 홈">
      <Image src="/molive-logo.png" alt="MOLIVE" width={2172} height={724} priority />
    </Link>
  );
}
