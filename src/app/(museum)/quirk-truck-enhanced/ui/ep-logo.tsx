import eplogo from './icon.png'
import Image from 'next/image';
import { lusitana } from './fonts';

export default function EpLogo() {
  return (
    <>
      <Image 
        className='object-contain'
        src={eplogo} 
        alt="EnterPrize logo, 7 points distributed on circle and each point is connected to each point." />
      <div className="text-[44px]">EnterPrize</div>
    </>
  );
}
