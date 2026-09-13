package types

import (
	"encoding/json/v2"
	"testing"
)

func TestSelectOptionJSONContract(t *testing.T) {
	input := []byte(`{"value":"PHP","label":"Philippine Peso","description":"Philippines","selected":true,"disabled":true}`)
	var option SelectOption
	if err := json.Unmarshal(input, &option); err != nil {
		t.Fatal(err)
	}
	if option.Value != "PHP" || option.Label != "Philippine Peso" || option.Description != "Philippines" || !option.Selected || !option.Disabled {
		t.Fatalf("option fields lost during decoding: %+v", option)
	}
	data, err := json.Marshal(option)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]any
	if err := json.Unmarshal(data, &fields); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"value", "label", "description", "selected", "disabled"} {
		if _, ok := fields[key]; !ok {
			t.Errorf("missing canonical JSON key %s", key)
		}
	}
}
