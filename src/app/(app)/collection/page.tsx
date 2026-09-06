import { CollectionDesk } from "@/components/collection-desk";

export default function CollectionPage() {
  return (
    <div className="flex min-h-0 flex-col xl:h-[calc(100dvh-6rem)]">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">दूध संग्रह</p>
          <h1 className="font-display text-[24px] leading-tight sm:text-[28px] sm:leading-none">Milk collection</h1>
        </div>
        <p className="hidden rounded-full bg-card px-3 py-1 text-xs text-muted md:block">
          Code → qty → FAT/SNF → slip
        </p>
      </div>
      <CollectionDesk />
    </div>
  );
}
