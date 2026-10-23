'use client';
import {usePathname} from 'next/navigation';
export function StudentFrame({header,footer,children}:{header:React.ReactNode;footer:React.ReactNode;children?:React.ReactNode}){const focus=/^\/s\/[^/]+\/(?:assignment|vocabulary)\/[^/]+\/?$/.test(usePathname());return <div className={focus?'student-focus-frame':'student-frame'} data-focus-mode={focus?'worksheet':undefined}>{!focus&&header}{children}{!focus&&footer}</div>;}
