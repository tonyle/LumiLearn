# Book batch import and extraction

User requests multi-file upload at creation, per-page editing/order and one-click OpenAI extraction with review accepted automatically. Implement in the existing book studio and OCR system.

1. Test multi-PDF/photo parsing, aggregate page limits, bulk progress/failures and automatic review. Use mocked OpenAI only.
2. Extend book-files import to accept mixed PDF/photos in selection order, enforce 20 files/50MB total/20MB each/50 pages per PDF/200 total pages. Creation uploads chosen files into the new draft and retains its ID on failure to avoid duplicate books.
3. Existing single-page extraction gains explicit autoReview option. Only successful nonempty OCR is marked reviewed. Preserve stale revision protection, authorization, opt-in, monthly budget and request idempotency.
4. Add sequential batch action using that endpoint, default skipping reviewed pages to avoid unnecessary cost, with optional replace-reviewed choice. Show page progress, per-page failures and stop-after-current support. Completed pages persist; reruns skip them. Do not publish automatically.
5. Add compact page thumbnails, status, selection and move earlier/later controls using existing page-order API; keep manual editing. Correct swapped-page revision handling and editor synchronization.
6. Run lint/typecheck/full tests, production build and deploy; verify HTTPS. No paid OpenAI requests or real learner changes in QA.
