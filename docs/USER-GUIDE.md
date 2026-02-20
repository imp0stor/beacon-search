# Beacon Search User Guide

**Version:** 2.0  
**Last Updated:** 2026-02-11

## Table of Contents

1. [Getting Started](#getting-started)
2. [Search Basics](#search-basics)
3. [Advanced Search](#advanced-search)
4. [Faceted Filtering](#faceted-filtering)
5. [Search Modes](#search-modes)
6. [Understanding Results](#understanding-results)
7. [Tips & Tricks](#tips--tricks)

---

## Getting Started

### Accessing Beacon Search

1. Open your browser and navigate to your Beacon Search URL (e.g., `https://search.company.com`)
2. Log in with your company credentials (if authentication is enabled)
3. You'll see the main search interface with a search bar and sidebar

### Interface Overview

```
┌─────────────────────────────────────────────────┐
│  🔦 Beacon Search            [Profile] [Help]   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │  🔍 Search across all your content... │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  [Hybrid] [Vector] [Text]                      │
│                                                 │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  FILTERS     │  SEARCH RESULTS                  │
│              │                                  │
│  □ Tags      │  📄 Document Title               │
│  □ People    │  Lorem ipsum dolor sit...        │
│  □ Orgs      │  📍 Source • 📅 2 days ago      │
│  □ Locations │                                  │
│  □ Sentiment │  📄 Another Document             │
│              │  Sample content preview...       │
│              │  📍 Source • 📅 1 week ago       │
│              │                                  │
└──────────────┴──────────────────────────────────┘
```

---

## Search Basics

### Simple Search

1. Type your query in the search box
2. Press **Enter** or click the search button
3. Results appear ranked by relevance

**Example queries:**
- `product roadmap`
- `how to reset password`
- `Q4 sales report`
- `customer feedback`

### Natural Language Queries

Beacon understands natural language:

- ❌ Don't overthink: `roadmap AND product OR 2024`
- ✅ Just ask: `product roadmap for 2024`

**More examples:**
- `how do I configure SSO?`
- `meeting notes from last week`
- `bugs related to authentication`
- `who is the engineering manager?`

---

## Advanced Search

### Phrase Search

Use quotes for exact phrases:

```
"engineering handbook"
"customer success story"
```

### Boolean Operators

Combine terms with AND, OR, NOT:

```
roadmap AND mobile
slack OR discord
security NOT compliance
```

### Wildcards

Use `*` for partial matches:

```
engin*       → engineering, engine, engineer
auth*        → authentication, authorization, author
```

### Field-Specific Search

Search specific fields (if supported):

```
title:"Product Vision"
author:"Jane Doe"
type:wiki
```

---

## Faceted Filtering

### Using Filters

Narrow results using the left sidebar:

#### 1. **Tags Filter**

Click tags to filter results:
- Click a tag to show only matching documents
- Click multiple tags (OR logic - shows documents with any selected tag)
- Click the ❌ icon to remove a filter

**Common tags:**
- `important`, `urgent`, `archived`
- `documentation`, `tutorial`, `reference`
- `bug`, `feature`, `enhancement`

#### 2. **People Filter** (Named Entities)

Find documents mentioning specific people:
- Select from auto-detected names
- Shows documents where that person is mentioned
- Useful for finding: meeting notes, assignments, authorship

#### 3. **Organizations Filter**

Filter by companies/orgs mentioned:
- Partners, clients, competitors
- Departments, teams

#### 4. **Locations Filter**

Find documents related to specific places:
- Office locations
- Project sites
- Geographic regions

#### 5. **Sentiment Filter**

Filter by document sentiment:
- 😊 **Positive**: Success stories, wins, praise
- 😐 **Neutral**: Factual documentation, specs
- 😟 **Negative**: Bug reports, complaints, issues

### Filter Combinations

Filters combine with AND logic:

```
Query: "customer feedback"
+ Tag: "important"
+ Sentiment: "negative"
= Shows critical customer complaints
```

### Active Filters

View and manage active filters:
- Shown as chips below search bar
- Click ❌ to remove individual filters
- Click "Clear All" to reset

---

## Search Modes

Beacon offers three search modes with different algorithms:

### 🔀 Hybrid Mode (Default)

**Best for:** General searches, everyday use

**How it works:**
- 70% semantic similarity (meaning-based)
- 30% keyword matching (text-based)
- Combines strengths of both approaches

**Example:**
```
Query: "how to debug memory leaks"

Finds:
✓ "Troubleshooting Memory Issues" (semantic match)
✓ "Debugging Guide" (keyword match)
✓ "Java Heap Analysis" (both)
```

### 🧠 Vector Mode

**Best for:** Conceptual searches, finding related ideas

**How it works:**
- Pure semantic similarity using AI embeddings
- Understands meaning and context
- Language-agnostic

**Example:**
```
Query: "improve application performance"

Finds:
✓ "Optimization Techniques"
✓ "Reducing Latency"
✓ "Caching Strategies"
✓ "Database Indexing"
(All conceptually related, even without exact keywords)
```

**When to use:**
- Exploring a topic broadly
- Finding conceptually similar documents
- When you know the concept but not the exact terms

### 📝 Text Mode

**Best for:** Exact keyword matching, known terms

**How it works:**
- Traditional full-text search
- Exact word matching with stemming
- Fast, precise

**Example:**
```
Query: "PostgreSQL 16 pgvector"

Finds:
✓ Documents containing those exact terms
✗ Misses: "Vector search with Postgres" (no exact match)
```

**When to use:**
- Searching for specific terms, codes, or IDs
- Looking for exact phrases
- Technical documentation with precise terminology

### Switching Modes

Click the mode buttons above results:
- Current mode is highlighted
- Results refresh automatically
- Your query stays the same

**Pro tip:** Try all three modes if you're not finding what you need!

---

## Understanding Results

### Result Card Anatomy

```
📄 Document Title                           [★ 0.95]
Preview text showing the most relevant excerpt from
the document content with query terms highlighted...

📍 Source: Confluence Wiki
📅 Modified: 2 days ago
👤 Author: Jane Doe
🏷️ Tags: documentation, tutorial, python

[View Full Document →]
```

**Elements:**
- **Title**: Document name (clickable link)
- **Preview**: Relevant excerpt with search terms highlighted
- **Relevance Score**: 0.0-1.0 (higher = better match)
- **Source**: Which integration/system the document came from
- **Modified Date**: Last updated timestamp
- **Author**: Document creator (if available)
- **Tags**: Auto-generated and manual tags

### Relevance Scores

- **0.9-1.0**: Excellent match (exactly what you're looking for)
- **0.7-0.9**: Good match (highly relevant)
- **0.5-0.7**: Fair match (somewhat relevant)
- **0.3-0.5**: Weak match (loosely related)
- **0.0-0.3**: Poor match (consider refining query)

### Result Ordering

Results are ranked by:
1. **Relevance**: Semantic + keyword similarity
2. **Recency**: Newer documents boosted slightly
3. **Quality Signals**: Completeness, length, tags

### Document Detail View

Click a result to see full details:

**Tabs:**
- **Content**: Full document text
- **Metadata**: All extracted info (author, dates, etc.)
- **Tags**: All tags (auto + manual)
- **Entities**: Extracted people, orgs, locations, dates
- **Related**: Similar documents based on content

**Actions:**
- **Open Source**: Deep link back to original system
- **Copy Link**: Share this document
- **Add Tags**: Manually tag for better organization
- **Report Issue**: Flag incorrect results

---

## Tips & Tricks

### 1. **Start Broad, Then Filter**

❌ Bad approach:
```
Query: "Q4 2024 sales report EMEA region PowerPoint"
```

✅ Better approach:
```
Query: "sales report"
Filter: Tags → "Q4", "2024"
Filter: Locations → "EMEA"
```

### 2. **Use Autocomplete**

As you type, Beacon suggests:
- Common queries
- Document titles
- Tags
- Entity names

Press **Tab** or **→** to accept suggestions.

### 3. **Explore Related Documents**

Found a relevant document?
1. Open document detail
2. Click "Related" tab
3. Discover similar content automatically

### 4. **Leverage Entity Extraction**

Find documents about a person without knowing exact query:
1. Search broadly (e.g., "product")
2. Click person's name in "People" filter
3. See all documents mentioning them

### 5. **Sentiment Filtering for Feedback**

Find all customer complaints:
```
Query: "customer feedback"
Filter: Sentiment → Negative
```

Find success stories:
```
Query: "customer feedback"
Filter: Sentiment → Positive
```

### 6. **Combine Search Modes**

Can't find what you need?
1. Try **Hybrid** first (default)
2. Switch to **Vector** for conceptual matches
3. Use **Text** if you know exact keywords

### 7. **Use Tags to Organize**

Add manual tags to important documents:
1. Open document
2. Click "Add Tag"
3. Type tag name (e.g., "must-read", "onboarding")
4. Find later by filtering

### 8. **Date Filtering**

While not a sidebar filter, you can search by date:
```
modified:2024
created:last-week
after:2024-01-01
```

### 9. **Export Results**

Save search results for later:
- **Bookmark**: Save search URL (includes query + filters)
- **Share Link**: Send to colleague
- **Export CSV**: Download result list (if enabled)

### 10. **Keyboard Shortcuts**

- **/** : Focus search box
- **Enter**: Execute search
- **Esc**: Clear search or close detail view
- **↑/↓**: Navigate results
- **Enter**: Open selected result
- **Ctrl+K**: Command palette (advanced)

---

## Common Use Cases

### 🎯 Onboarding

**Goal**: Find all onboarding materials

```
Query: "onboarding" OR "getting started" OR "welcome"
Filter: Tags → "onboarding", "new-hire"
Mode: Hybrid
```

### 🐛 Troubleshooting

**Goal**: Find solutions to an error

```
Query: "Connection timeout error 504"
Mode: Text (for exact error codes)
Filter: Tags → "troubleshooting", "bug"
```

### 📊 Research

**Goal**: Explore a topic broadly

```
Query: "machine learning in healthcare"
Mode: Vector (for conceptual matches)
Review: Click through related documents
```

### 🔍 Finding a Specific Document

**Goal**: Locate a document you remember

```
Query: Title phrase in quotes
Filter: Author → "John Smith"
Filter: Source → "Confluence"
Mode: Text
```

### 📈 Competitive Analysis

**Goal**: Find mentions of competitors

```
Query: "competitor analysis"
Filter: Organizations → "CompetitorCo"
Filter: Sentiment → See how they're discussed
```

### 🎓 Learning & Training

**Goal**: Find tutorials on a topic

```
Query: "how to use Kubernetes"
Filter: Tags → "tutorial", "documentation"
Sort: By date (newest first)
```

---

## Troubleshooting

### "No Results Found"

**Try:**
1. Simplify query (fewer words)
2. Check spelling
3. Switch to **Vector** mode (more forgiving)
4. Remove some filters
5. Try synonyms

### Results Not Relevant

**Try:**
1. Switch to **Text** mode for exact matching
2. Use quotes for phrases
3. Add boolean operators (AND, NOT)
4. Apply more specific filters

### Can't Find Recent Document

**Check:**
1. Is the source synced recently? (Check sync status)
2. Are you filtering by date unintentionally?
3. Does the document have restricted permissions?

### Slow Search

**Tips:**
- Narrow with filters first, then search
- Avoid very broad queries
- Try fewer filters simultaneously
- Contact admin if consistently slow

---

## Getting Help

### Built-in Help

- **?** icon in top right → Quick tips
- **Help Center** → Full documentation
- **Keyboard shortcuts** → Press `?` key

### Support

- **In-app feedback**: Click feedback button
- **Email**: support@yourcompany.com
- **Slack**: #beacon-search channel

### Feature Requests

Have an idea? Submit via:
- Feedback button → "Suggest Feature"
- Email with subject "Feature Request"

---

## Privacy & Permissions

### What Can You See?

Beacon respects source system permissions:
- Only documents you have access to appear in results
- Permissions synced from source systems
- Searches are logged for analytics (anonymized)

### What's Indexed?

- Documents from connected sources (Confluence, Slack, etc.)
- Only text content (no code execution, no formulas)
- Metadata (author, dates, etc.)

### What's NOT Indexed?

- Private messages (unless explicitly configured)
- Deleted documents
- Password-protected files
- Draft documents (usually)

---

## Best Practices

### For Better Search Results

1. **Use natural language** - Don't over-engineer queries
2. **Start simple** - Add complexity only if needed
3. **Explore filters** - They're powerful but underused
4. **Try all modes** - Each has strengths
5. **Tag important docs** - Help yourself and others

### For Better Organization

1. **Add manual tags** to key documents
2. **Bookmark** common searches
3. **Use consistent terminology** in documents
4. **Report bad results** to improve relevance

### For Teams

1. **Share searches** via URL (includes query + filters)
2. **Create tag conventions** ("must-read", "deprecated")
3. **Document your knowledge** in source systems
4. **Provide feedback** on relevance

---

## Appendix: Search Query Syntax

### Operators

| Operator | Example | Description |
|----------|---------|-------------|
| AND | `cat AND dog` | Both terms required |
| OR | `cat OR dog` | Either term matches |
| NOT | `cat NOT dog` | First term, exclude second |
| ( ) | `(cat OR dog) AND animal` | Group operations |
| " " | `"black cat"` | Exact phrase |
| * | `engine*` | Wildcard (suffix) |

### Field Search (if enabled)

| Field | Example | Description |
|-------|---------|-------------|
| title: | `title:"User Guide"` | Search in title only |
| author: | `author:"Jane"` | Search by author |
| type: | `type:wiki` | Search by document type |
| tag: | `tag:urgent` | Search by tag |

### Special Filters

| Filter | Example | Description |
|--------|---------|-------------|
| modified: | `modified:2024` | Modified in 2024 |
| created: | `created:last-week` | Created last week |
| after: | `after:2024-01-01` | After date |
| before: | `before:2023-12-31` | Before date |

---

**Happy Searching! 🔦**
