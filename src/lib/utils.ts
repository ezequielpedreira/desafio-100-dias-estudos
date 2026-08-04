import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs:ClassValue[]){return twMerge(clsx(inputs));}
export function formatDuration(totalSeconds:number,withSeconds=false){const safe=Math.max(0,Math.floor(totalSeconds));const hours=Math.floor(safe/3600);const minutes=Math.floor((safe%3600)/60);const seconds=safe%60;if(withSeconds)return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;if(hours)return `${hours}h ${String(minutes).padStart(2,"0")}min`;return `${minutes}min`;}
export function initials(name:string){return name.split(" ").filter(Boolean).slice(0,2).map((part)=>part[0]).join("").toUpperCase();}
