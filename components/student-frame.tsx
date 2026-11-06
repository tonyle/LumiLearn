'use client';
import {usePathname} from 'next/navigation';
export function StudentFrame({header,footer,children}:{header:React.ReactNode;footer:React.ReactNode;children?:React.ReactNode}){const path=usePathname();const focus=/^\/s\/[^/]+\/(?:assignment|vocabulary|books)\/[^/]+\/?$/.test(path);return <div className={focus?'student-focus-frame':'student-frame'} data-focus-mode={focus?(path.includes('/books/')?'book':'worksheet'):undefined}>{!focus&&header}{children}{!focus&&footer}</div>;}
