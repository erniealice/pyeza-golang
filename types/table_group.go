package types

import (
	"sort"
	"strconv"
	"strings"
)

// GroupRowsByValueOptions configures GroupRowsByValue's band ordering and
// per-band identity. It carries no domain knowledge: the caller resolves the
// per-row value map, supplies the leading band order, and owns the band-ID
// shape (prefix + slug) so different surfaces keep their own testid namespace.
type GroupRowsByValueOptions struct {
	// LeadingOrder pins the leading bands to these values (case-insensitive,
	// trimmed; listed values lead in list order). Values not listed follow in
	// ascending value order; the no-value band stays last. Empty = pure
	// ascending value order.
	LeadingOrder []string
	// GroupID maps a band value to its group ID; the same string is reused as
	// the band's DataAttrs "testid". The caller owns the prefix (e.g.
	// "rc-band-<slug>", "sg-band-<slug>"). A nil GroupID yields empty IDs.
	GroupID func(value string) string
	// NoValueTitle is the title for the no-value (empty) band. Empty defaults
	// to "—".
	NoValueTitle string
}

// GroupRowsByValue partitions rows into TableRowGroup bands keyed by
// valueByRowID[row.ID]. Band order: LeadingOrder values lead (case-insensitive,
// in list order), then the remaining values ascending, and the no-value band
// last. Rows keep their incoming order within a band (stable partition), so the
// caller sorts before calling. The caller decides WHETHER to band: a nil/empty
// value map collates every row into a single trailing band rather than a flat
// table, so pass only a map that meaningfully partitions the rows.
func GroupRowsByValue(rows []TableRow, valueByRowID map[string]string, opts GroupRowsByValueOptions) []TableRowGroup {
	rank := func(value string) (int, bool) {
		v := strings.ToLower(strings.TrimSpace(value))
		for i, want := range opts.LeadingOrder {
			if strings.ToLower(strings.TrimSpace(want)) == v {
				return i, true
			}
		}
		return 0, false
	}

	order := []string{}
	seen := map[string]bool{}
	buckets := map[string][]TableRow{}
	for _, r := range rows {
		v := valueByRowID[r.ID]
		if !seen[v] {
			seen[v] = true
			order = append(order, v)
		}
		buckets[v] = append(buckets[v], r)
	}
	sort.SliceStable(order, func(i, j int) bool {
		a, b := order[i], order[j]
		if (a == "") != (b == "") {
			return b == "" // no-value band last
		}
		ra, aListed := rank(a)
		rb, bListed := rank(b)
		if aListed != bListed {
			return aListed // configured values lead
		}
		if aListed && bListed && ra != rb {
			return ra < rb
		}
		return strings.ToLower(a) < strings.ToLower(b)
	})

	noValueTitle := opts.NoValueTitle
	if noValueTitle == "" {
		noValueTitle = "—"
	}
	groups := make([]TableRowGroup, 0, len(order))
	usedIDs := map[string]bool{}
	for _, v := range order {
		title := v
		if title == "" {
			title = noValueTitle
		}
		id := ""
		if opts.GroupID != nil {
			id = opts.GroupID(v)
		}
		// Two distinct raw buckets can slug to the same ID (e.g. "Male" and
		// "male" both slug to "…-male"). Raw buckets stay separate (locked
		// behavior — no case-folding); later duplicates get a -2, -3… suffix so
		// every band ID / testid is unique.
		if id != "" && usedIDs[id] {
			base := id
			for n := 2; ; n++ {
				id = base + "-" + strconv.Itoa(n)
				if !usedIDs[id] {
					break
				}
			}
		}
		if id != "" {
			usedIDs[id] = true
		}
		groups = append(groups, TableRowGroup{
			ID:        id,
			Title:     title,
			Rows:      buckets[v],
			DataAttrs: map[string]string{"testid": id},
		})
	}
	return groups
}
