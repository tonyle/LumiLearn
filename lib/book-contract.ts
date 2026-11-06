export type BookRegion={id:string;text:string;x:number;y:number;width:number;height:number};
export type Book={id:string;title:string;description:string;grade:string;published:boolean;deleted_at:string|null;updated_at:string;revision:number;page_count?:number};
export type BookPage={id:string;book_id:string;page_number:number;width:number;height:number;regions:BookRegion[];reviewed:boolean;image_key:string;revision:number};
export type BookDetail={book:Book;pages:BookPage[];studentIds:string[]};
