"""
Throwaway probe: does the `scholarly` PyPI package fetch André's Scholar profile
from this machine's (residential) IP? Prints profile stats + the first few
publications, and fills one publication to check the abstract comes through.

Run:  python3.12 -m venv .venv && .venv/bin/pip install scholarly && .venv/bin/python scripts/scholarly_probe.py
"""
from scholarly import scholarly

USER = "U20zUHQAAAAJ"

print(f"→ search_author_id({USER})")
author = scholarly.search_author_id(USER)
scholarly.fill(author, sections=["basics", "indices", "publications"])

print(f"  name:      {author.get('name')}")
print(f"  affil:     {author.get('affiliation')}")
print(f"  citedby:   {author.get('citedby')}")
print(f"  hindex:    {author.get('hindex')}")
print(f"  i10index:  {author.get('i10index')}")
pubs = author.get("publications", [])
print(f"  #pubs:     {len(pubs)}")

for p in pubs[:5]:
    b = p.get("bib", {})
    print(f"    - [{b.get('pub_year','?')}] {b.get('title','?')[:70]}  (cites={p.get('num_citations')})")

# Fill one publication to confirm the abstract is retrievable.
if pubs:
    print("\n→ fill first publication for abstract…")
    first = scholarly.fill(pubs[0])
    abs_ = first.get("bib", {}).get("abstract")
    print(f"  abstract: {(abs_[:240] + '…') if abs_ else 'NONE'}")
