'use client';
import Link from 'next/link';
export function WorksheetLink({href,className,children,ariaLabel}:{href:string;className?:string;children?:React.ReactNode;ariaLabel?:string}){return <Link href={href} className={className} aria-label={ariaLabel} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;if(!document.fullscreenElement&&document.documentElement.requestFullscreen)void document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{});}}>{children}</Link>;}
