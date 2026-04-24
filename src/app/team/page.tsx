const imgVector1 = "https://www.figma.com/api/mcp/asset/0e874632-4fcd-495c-8bbb-0b6c6bd2c209";
const imgMapPin = "https://www.figma.com/api/mcp/asset/527b710d-f6cf-464c-a24b-94742c4ff1a7";
const imgSvg = "https://www.figma.com/api/mcp/asset/a3b432f7-58a8-4a83-804a-d477c7dc11f6";

const members = [
  {
    name: "MOHSEN SHIRDELI",
    role: "Ceo & Founder",
    img: "https://www.figma.com/api/mcp/asset/322b5780-00b6-4ff2-80e4-43d23dccfdc2",
    conversation: "Moshen",
  },
  {
    name: "AMANOLLAH AFSHAR",
    role: "Operations Manager",
    img: "https://www.figma.com/api/mcp/asset/65cd1e59-4da6-4414-bde2-51534b71cf99",
    conversation: "Aman",
  },
  {
    name: "ALI SHIRDELI",
    role: "IT Manager / Sales Consultant",
    img: "https://www.figma.com/api/mcp/asset/ac82ac90-a4f6-40c5-81bd-b0390ad4ab75",
    conversation: "Ali",
  },
  {
    name: "SARA FARZIN",
    role: "Tourism Manager / Sale Consultant",
    img: "https://www.figma.com/api/mcp/asset/ee630e8b-588b-414b-98db-d316d37ba4f7",
    conversation: "Sara",
  },
  {
    name: "MEHDI SARRAF",
    role: "International Sale Manager",
    img: "https://www.figma.com/api/mcp/asset/6799dda0-f702-4cd8-ba34-356480760e35",
    conversation: "Mehdi",
  },
  {
    name: "MOHAMMAD FAYZAL",
    role: "Coordinate Manager",
    img: "https://www.figma.com/api/mcp/asset/5920ce6a-9240-471f-a7c9-ff7db120d8c9",
    conversation: "Faysal",
  },
  {
    name: "MOHAMMAD NIKFAR",
    role: "Sale Consultant",
    img: "https://www.figma.com/api/mcp/asset/9074d457-6718-451a-8e06-cf74413e4018",
    conversation: "Nikfar",
  },
  {
    name: "NAZEER ABBAS RIZVI",
    role: "Sale Consultant",
    img: "https://www.figma.com/api/mcp/asset/6315931d-711a-45ce-bd0f-4edc3e39c7f0",
    conversation: "Amir",
  },
  {
    name: "KOUROSH KHALEGHI",
    role: "Digital Marketing / Sale Consultant",
    img: "https://www.figma.com/api/mcp/asset/99e9c2e4-aae0-45ff-959a-7ca9b5a56471",
    conversation: "Kourosh",
  },
  {
    name: "AMIR REZA SHAMSIPOUR",
    role: "IT & Development / Sale Consultant",
    img: "https://www.figma.com/api/mcp/asset/3e148565-26a2-444d-b1de-47675a7b761f",
    conversation: "Kourosh",
  },
];

function MemberCard({
  name,
  role,
  img,
  conversation,
}: {
  name: string;
  role: string;
  img: string;
  conversation: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="h-[303px] bg-black overflow-hidden">
        <img alt={name} src={img} className="w-full h-full object-cover object-top" />
      </div>
      <div className="pt-3 pb-1 flex items-center gap-2">
        <img src={imgVector1} alt="" className="w-[14px] h-[14px] flex-shrink-0" />
        <span className="font-semibold text-[15px] text-black tracking-[0.52px]">{name}</span>
      </div>
      <p className="text-[13px] text-black tracking-[0.4px] mb-1">{role}</p>
      <div className="flex items-center gap-1 mb-3">
        <img src={imgMapPin} alt="location" className="w-[14px] h-[14px] flex-shrink-0 opacity-50" />
        <span className="text-[13px] text-black/50 tracking-[0.4px]">Muscat , Oman</span>
      </div>
      <button className="w-full bg-[#33442f] text-white text-[13px] tracking-[0.4px] capitalize py-2.5">
        Start Conversation with {conversation}
      </button>
    </div>
  );
}

export default function TeamPage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Left border accent */}
      <div className="flex">
        <div className="w-[160px] flex-shrink-0 border-r border-[#e3ded9] min-h-screen" />
        <div className="flex-1 px-12 py-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-8">
            <img src={imgSvg} alt="" className="w-5 h-5" />
            <nav className="flex items-center gap-2 text-[#947d15] text-[15px] tracking-[0.04px] uppercase font-semibold">
              <a href="/" className="hover:underline">Home</a>
              <span className="text-black/30">&gt;</span>
              <span>Contact Us</span>
            </nav>
          </div>

          {/* Header */}
          <h1 className="text-[42px] tracking-[1px] uppercase text-[#514f4f] mb-3">
            Meet The Team
          </h1>
          <p className="text-[18px] text-[#1e1e1e] tracking-[0.4px] mb-12 max-w-[480px]">
            Local experts, globally connected and ready to guide you on your home-buying and selling journey.
          </p>

          {/* Grid */}
          <div className="grid grid-cols-4 gap-6">
            {members.map((m) => (
              <MemberCard key={m.name} {...m} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
