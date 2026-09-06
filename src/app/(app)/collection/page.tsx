import { CollectionDesk } from "@/components/collection-desk";

export default function CollectionPage() {
  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">दूध संग्रह</p>
          <h1 className="font-display text-2xl leading-tight">Milk collection</h1>
        </div>
        <p className="hidden text-xs text-muted md:block">Code → qty → FAT/SNF → slip</p>
      </div>
      <CollectionDesk />
    </div>
  );
}
