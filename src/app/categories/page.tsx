const imgTabBar = "https://www.figma.com/api/mcp/asset/b6a8bad1-e276-4a73-8a67-82f656d35e64";
const imgVector = "https://www.figma.com/api/mcp/asset/ccd6933a-127e-42dc-8046-8fa41d5e1725";
const imgVector1 = "https://www.figma.com/api/mcp/asset/a740ca58-91c4-4136-b980-301c961a8001";
const imgVector2 = "https://www.figma.com/api/mcp/asset/e8999fb7-1ff4-47c0-a63f-4e183f52255f";
const imgVector3 = "https://www.figma.com/api/mcp/asset/70c0a4f0-67af-4a5d-8d78-b85af47689b7";
const imgVector4 = "https://www.figma.com/api/mcp/asset/7553335a-a403-441c-bb2b-4cb8f15032b2";
const imgVector5 = "https://www.figma.com/api/mcp/asset/d3ae7152-9792-4bbd-8032-3f80cdbaa13c";
const imgMedia = "https://www.figma.com/api/mcp/asset/60f79780-dd6d-44bf-b3fc-dcf28fd2d28d";
const imgVector6 = "https://www.figma.com/api/mcp/asset/0a9d4c4c-605c-4af5-9ccf-f9e30edb69bf";
const imgVector7 = "https://www.figma.com/api/mcp/asset/f35a99e1-b1e1-444c-8769-f5af8b50968a";
const imgMedia1 = "https://www.figma.com/api/mcp/asset/4b537343-8f96-4256-9cfa-023ac13e8dad";
const imgMedia2 = "https://www.figma.com/api/mcp/asset/27ebd822-2d42-4831-850d-408433c54a4d";
const imgMedia3 = "https://www.figma.com/api/mcp/asset/e78f294f-4acb-43a6-9aff-06080d494c3b";
const imgMedia5 = "https://www.figma.com/api/mcp/asset/f5bb854d-ad7d-4835-a003-b73331aab0f7";
const imgVector8 = "https://www.figma.com/api/mcp/asset/22fb7c04-02b6-4995-9153-57bb29a68d1c";

const categories = [
  { name: "Vegetables", count: 43, img: imgMedia },
  { name: "Fruits", count: 32, img: null },
  { name: "Bread", count: 22, img: imgMedia3 },
  { name: "Sweets", count: 56, img: imgMedia5 },
  { name: "Pasta", count: 43, img: imgMedia1 },
  { name: "Drinks", count: 43, img: imgMedia2 },
];

function ItemCard({ name, count, img }: { name: string; count: number; img: string | null }) {
  return (
    <div className="relative rounded-[8px] bg-white border border-[#d9d0e3] overflow-hidden h-[211px]">
      <div className="h-[140px] bg-[#dbd8dd] overflow-hidden rounded-t-[8px]">
        {img && (
          <img alt={name} className="w-full h-full object-cover" src={img} />
        )}
      </div>
      <div className="px-4 pt-2">
        <p className="font-bold text-[18px] text-[#2d0c57] leading-normal">{name}</p>
        <p className="text-[12px] text-[#9586a8] leading-normal">({count})</p>
      </div>
    </div>
  );
}

export default function Categories() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-[#f6f5f5] h-[896px] w-[414px] relative overflow-hidden flex flex-col">
        {/* Navigation Bar */}
        <div className="h-[96px] flex items-center px-5 flex-shrink-0">
          <a href="/" className="text-[#2d0c57]">
            <img alt="Back" className="h-[14px]" src={imgVector8} />
          </a>
        </div>

        {/* Title */}
        <div className="px-5 mb-4 flex-shrink-0">
          <h1 className="font-bold text-[34px] tracking-[0.41px] text-[#2d0c57]">Categories</h1>
        </div>

        {/* Search */}
        <div className="px-5 mb-6 flex-shrink-0">
          <div className="h-[48px] bg-white border border-[#d9d0e3] rounded-[27px] flex items-center px-4 gap-3">
            <div className="relative size-[24px] flex-shrink-0">
              <img alt="" className="absolute inset-0 w-full h-full object-contain" src={imgVector6} />
            </div>
            <span className="text-[17px] text-[#9586a8] tracking-[-0.41px]">Search</span>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-5">
          <div className="grid grid-cols-2 gap-4 pb-4">
            {categories.map((cat) => (
              <ItemCard key={cat.name} {...cat} />
            ))}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="h-[80px] flex-shrink-0 border-t border-[#d9d0e3] relative">
          <img alt="" className="absolute inset-0 w-full h-full object-cover" src={imgTabBar} />
          <div className="absolute inset-0 flex">
            {/* Grid tab (active) */}
            <div className="flex-1 flex items-center justify-center">
              <img alt="Home" className="size-[24px] object-contain" src={imgVector} />
            </div>
            {/* Cart tab */}
            <div className="flex-1 flex items-center justify-center">
              <img alt="Cart" className="size-[24px] object-contain" src={imgVector1} />
            </div>
            {/* Profile tab */}
            <div className="flex-1 flex items-center justify-center">
              <img alt="Profile" className="size-[24px] object-contain" src={imgVector4} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
