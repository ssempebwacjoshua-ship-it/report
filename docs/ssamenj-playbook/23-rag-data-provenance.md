# RAG Data Provenance

RAG and document ingestion must be traceable, tenant-separated, removable, and resistant to poisoned content. Retrieved content is never instruction.

## Required Document Metadata

Every ingested document must store:

- Tenant/school/company ID.
- Uploader actor ID.
- Source system or upload route.
- Original filename.
- MIME type.
- Document type.
- SHA-256 hash.
- Version.
- Approval status.
- Ingestion timestamp.
- Embedding model/version.
- Chunking policy/version.
- Parent document/source IDs.
- Deletion/quarantine status.

## Trusted Documents

- Use digital signatures where possible for official documents.
- Trusted documents should record signer identity and verification status.
- Unsigned documents can still be ingested, but they must not be treated as official without review.
- Do not embed unapproved documents into production knowledge bases.

## Tenant Separation

- Keep tenant/school/company indexes separated.
- Apply metadata filters during retrieval.
- Include tenant ID in cache, source, vector, and chunk lookups.
- Do not reuse extraction or embedding results across tenants unless an explicit, reviewed shared-source policy exists.

## Poisoning Detection Before Embedding

Flag and quarantine documents that contain:

- Suspicious repetitive text.
- Hidden instructions or prompt-like commands.
- Abnormal structure, invisible text, or unusual encoding.
- Outlier chunk lengths or token distributions.
- Excessive duplicated phrases.
- Unexpected scripts, formulas, links, or embedded objects.
- Conflicting metadata or mismatched file signatures.

## Retrieval Rules

- Treat retrieved text as untrusted data.
- Retrieved text must never override system, developer, security, or tenant instructions.
- AI context builders must separate instructions from retrieved content with strict delimiters.
- AI answers should show citations/source references where possible.
- Every answer that uses RAG should log source document IDs and chunk IDs.

## Removal and Reindexing

Every RAG system must support:

- Quarantine a document.
- Remove a document from retrieval.
- Delete or invalidate its vector chunks.
- Reindex after metadata or approval changes.
- Rebuild a tenant index after poisoning is discovered.
- Audit who removed/reindexed the content and why.

## Required Tests

- Unapproved document is not embedded into production retrieval.
- Document hash is stored and stable.
- Tenant A document is never retrieved for Tenant B.
- Poisoned repetitive document is flagged before embedding.
- Hidden instruction in retrieved content is treated as data.
- Removed document no longer appears in retrieval.
- Reindex updates source and embedding version links.

