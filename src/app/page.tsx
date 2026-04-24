const imgBg = "https://www.figma.com/api/mcp/asset/9f79706b-05c8-4b6f-9905-ec6624c23835";
const imgLogo = "https://www.figma.com/api/mcp/asset/ec8ebe91-0c65-4c6a-b22b-c9b5af54a1c6";
const imgBackdropBase = "https://www.figma.com/api/mcp/asset/5227797c-0b94-467b-93f1-a2cef516bc52";
const imgIcon = "https://www.figma.com/api/mcp/asset/5cb5eaa6-15fe-4b76-8fe1-26318d26b143";

export default function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-[#a259ff] h-[896px] overflow-hidden relative w-[414px]">
        {/* Background */}
        <div className="absolute h-[975px] left-[-195px] top-[-251px] w-[1032px]">
          <img alt="" className="absolute inset-0 w-full h-full object-cover" src={imgBg} />
        </div>

        {/* Logo */}
        <div className="absolute left-[20px] top-[63px] size-[63px]">
          <img alt="Logo" className="w-full h-full object-contain" src={imgLogo} />
        </div>

        {/* Backdrop card */}
        <div className="absolute inset-x-0 bottom-0 top-[312px]">
          <img alt="" className="absolute inset-0 w-full h-full object-fill" src={imgBackdropBase} />

          {/* Icon */}
          <div className="absolute left-1/2 -translate-x-1/2 top-[80px] size-[104px]">
            <img alt="Delivery icon" className="w-full h-full object-contain" src={imgIcon} />
          </div>

          {/* Heading */}
          <div className="absolute left-1/2 -translate-x-1/2 top-[210px] w-[326px] text-center">
            <p className="font-bold text-[34px] leading-[41px] tracking-[0.41px] text-[#2d0c57]">
              Non-Contact Deliveries
            </p>
          </div>

          {/* Body text */}
          <div className="absolute left-1/2 -translate-x-1/2 top-[295px] w-[374px] text-center">
            <p className="text-[17px] leading-[1.5] tracking-[-0.41px] text-[#9586a8]">
              When placing an order, select the option "Contactless delivery" and the courier will leave your order at the door.
            </p>
          </div>

          {/* Primary button */}
          <div className="absolute left-[20px] right-[20px] top-[424px]">
            <a href="/categories" className="flex items-center justify-center w-full h-[56px] bg-[#0bce83] rounded-[8px] text-white text-[15px] font-semibold tracking-[-0.01px] uppercase">
              Order Now
            </a>
          </div>

          {/* Dismiss */}
          <div className="absolute left-1/2 -translate-x-1/2 top-[512px]">
            <button className="text-[#9586a8] text-[15px] font-semibold tracking-[-0.01px] uppercase">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
