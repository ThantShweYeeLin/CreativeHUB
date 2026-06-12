import svgPaths from "./svg-amaxma8v8u";

function Component1({ className }: { className?: string }) {
  return (
    <div className={className || "absolute bg-white h-[308px] left-[244px] top-[255px] w-[516px]"} data-name="Component 4">
      <div className="absolute bg-[#d9d9d9] inset-0 rounded-[10px]" />
    </div>
  );
}

function Component({ className }: { className?: string }) {
  return (
    <div className={className || "absolute h-[31px] left-[429px] top-[367px] w-[150px]"} data-name="Component 1">
      <p className="absolute font-['Montserrat:SemiBold',sans-serif] font-semibold inset-[16.67%_0_20.83%_24.14%] leading-[normal] text-[13px] text-black">Upload photos</p>
      <div className="absolute inset-[0_79.31%_0_0]" data-name="Add_square">
        <div className="absolute inset-[12.5%]">
          <div className="absolute inset-[-4.3%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 25.2759 25.25">
              <path d={svgPaths.p5eda400} id="Rectangle 1" stroke="var(--stroke-0, #222222)" strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div className="absolute bottom-[33.33%] left-1/2 right-1/2 top-[33.33%]">
          <div className="absolute inset-[-9.68%_-1px]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2 12.3333">
              <path d="M1 1V11.3333" id="Vector 52" stroke="var(--stroke-0, #222222)" strokeLinecap="square" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div className="absolute bottom-1/2 flex items-center justify-center left-[33.33%] right-[33.33%] top-1/2" style={{ containerType: "size" }}>
          <div className="flex-none h-[100cqw] rotate-90 w-[285967000cqh]">
            <div className="relative size-full">
              <div className="absolute inset-[-9.67%_-1px]">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2 12.3448">
                  <path d="M1 1V11.3448" id="Vector 53" stroke="var(--stroke-0, #222222)" strokeLinecap="square" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Icon() {
  return (
    <button className="absolute block cursor-pointer left-[18px] size-[56px] top-[33px]" data-name="_Icon">
      <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 56 56">
        <g id="_Icon">
          <path d={svgPaths.p38ed6300} fill="var(--fill-0, black)" id="Icon" />
        </g>
      </svg>
    </button>
  );
}

export default function ImageSearch() {
  return (
    <div className="drop-shadow-[0px_4px_2px_rgba(0,0,0,0.25)] relative size-full" data-name="image search">
      <div className="absolute bg-white h-[734px] left-0 top-0 w-[1007px]" />
      <div className="absolute bg-[#cdcdcd] h-[35px] left-[165px] rounded-[10px] top-[45px] w-[659px]" />
      <p className="absolute font-['Montserrat:Regular',sans-serif] font-normal leading-[normal] left-[207px] text-[12px] text-black top-[55px] whitespace-nowrap">Search more category...</p>
      <div className="absolute h-[465px] left-[125px] top-[194px] w-[739px]" />
      <Component1 />
      <div className="absolute inset-[7.08%_80.34%_90.46%_17.87%]" data-name="Vector">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.0058 18.0058">
          <path d={svgPaths.p667ac00} fill="var(--fill-0, black)" id="Vector" />
        </svg>
      </div>
      <Component />
      <div className="absolute bg-[#cdcdcd] h-[35px] left-[198px] rounded-[10px] top-[127px] w-[92px]" />
      <p className="absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[216px] text-[16px] text-black top-[135px] whitespace-nowrap">{` Drafts`}</p>
      <Icon />
      <p className="absolute font-['Montserrat:SemiBold',sans-serif] font-semibold h-[25px] leading-[normal] left-[378px] text-[16px] text-black top-[132px] w-[300px]">Upload your inspirations</p>
    </div>
  );
}