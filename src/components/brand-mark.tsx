import Link from "next/link";
import { Zap } from "lucide-react";
import { brand } from "@/lib/brand";
export function BrandMark({compact=false}:{compact?:boolean}){return <Link href="/" className="flex items-center gap-3" aria-label={`${brand.name}, página inicial`}><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#6c4cff] text-white shadow-[0_4px_0_#4c32ca]"><Zap size={21} fill="currentColor"/></span>{!compact&&<span className="font-display text-xl font-black tracking-[-.04em]">LevelUp <span className="text-[#6c4cff]">100</span></span>}</Link>}
