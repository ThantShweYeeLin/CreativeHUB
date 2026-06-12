export default function ClientNotifications() {
  return (
    <div className="drop-shadow-[0px_4px_2px_rgba(0,0,0,0.25)] relative size-full" data-name="client notifications">
      <div className="absolute bg-[#d9d9d9] h-[494px] left-0 rounded-[10px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] top-0 w-[342px]" />
      <div className="absolute bg-[#c4c4c4] h-[67px] left-[14px] rounded-[10px] top-[17px] w-[313px]" />
      <div className="absolute h-[45px] left-[26px] top-[27px] w-[51px]">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 51 45">
          <ellipse cx="25.5" cy="22.5" fill="var(--fill-0, #D9D9D9)" id="Ellipse 72" rx="25.5" ry="22.5" />
        </svg>
      </div>
      <div className="absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[0] left-[93px] text-[14px] text-black top-[41px] tracking-[-0.56px] whitespace-nowrap">
        <p className="leading-[normal] mb-0 whitespace-pre">@username has accepted</p>
        <p className="leading-[normal] whitespace-pre">{` your request!!`}</p>
      </div>
      <div className="absolute bg-[#c4c4c4] h-[67px] left-[14px] rounded-[10px] top-[103px] w-[313px]" />
      <div className="absolute h-[45px] left-[26px] top-[113px] w-[51px]">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 51 45">
          <ellipse cx="25.5" cy="22.5" fill="var(--fill-0, #D9D9D9)" id="Ellipse 72" rx="25.5" ry="22.5" />
        </svg>
      </div>
      <p className="absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[93px] text-[14px] text-black top-[127px] tracking-[-0.56px] whitespace-nowrap">@username has send a message!</p>
      <div className="absolute bg-[#c4c4c4] h-[67px] left-[14px] rounded-[10px] top-[189px] w-[313px]" />
      <div className="absolute h-[45px] left-[26px] top-[199px] w-[51px]">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 51 45">
          <ellipse cx="25.5" cy="22.5" fill="var(--fill-0, #D9D9D9)" id="Ellipse 72" rx="25.5" ry="22.5" />
        </svg>
      </div>
      <p className="absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[normal] left-[93px] text-[14px] text-black top-[213px] tracking-[-0.56px] whitespace-nowrap">@username liked your post!</p>
      <div className="absolute bg-[#c4c4c4] h-[67px] left-[14px] rounded-[10px] top-[361px] w-[313px]" />
      <div className="absolute h-[45px] left-[26px] top-[371px] w-[51px]">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 51 45">
          <ellipse cx="25.5" cy="22.5" fill="var(--fill-0, #D9D9D9)" id="Ellipse 72" rx="25.5" ry="22.5" />
        </svg>
      </div>
      <div className="absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[0] left-[93px] text-[14px] text-black top-[377px] tracking-[-0.56px] whitespace-nowrap">
        <p className="leading-[normal] mb-0 whitespace-pre">{`@username commented on `}</p>
        <p className="leading-[normal] whitespace-pre">your post!</p>
      </div>
      <div className="absolute bg-[#c4c4c4] h-[67px] left-[14px] rounded-[10px] top-[275px] w-[313px]" />
      <div className="absolute h-[45px] left-[26px] top-[285px] w-[51px]">
        <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 51 45">
          <ellipse cx="25.5" cy="22.5" fill="var(--fill-0, #D9D9D9)" id="Ellipse 72" rx="25.5" ry="22.5" />
        </svg>
      </div>
      <div className="absolute font-['Montserrat:SemiBold',sans-serif] font-semibold leading-[0] left-[93px] text-[14px] text-black top-[291px] tracking-[-0.56px] whitespace-nowrap">
        <p className="leading-[normal] mb-0 whitespace-pre">@username rejected your</p>
        <p className="leading-[normal] whitespace-pre">{` request!`}</p>
      </div>
    </div>
  );
}