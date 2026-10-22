'use client';
import Link from 'next/link';import {usePathname} from 'next/navigation';import {Home,BookOpen,Users,CalendarDays,FileUp,Settings,GraduationCap,Import,Brain,Activity} from 'lucide-react';
const icons={Home,BookOpen,Users,CalendarDays,FileUp,Settings,GraduationCap,Import,Brain,Activity};
export function StudioNav({links,label}:{links:{href:string;label:string;icon:keyof typeof icons}[];label:string}){const path=usePathname();return <nav className="studio-nav" aria-label={label}>{links.map(link=>{const Icon=icons[link.icon];return <Link key={link.href} href={link.href} aria-current={(path===link.href||link.href!=='/parent'&&path.startsWith(link.href+'/'))?'page':undefined}><Icon size={19}/><span>{link.label}</span></Link>})}</nav>;}
