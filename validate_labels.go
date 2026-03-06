package pyeza

import (
	"fmt"
	"reflect"
)

// ValidateLabels recursively walks all string fields of target and returns
// warnings for any that are empty. name is a human-readable prefix for the
// warning messages (e.g. "ServiceAdmin.SalesLabels").
func ValidateLabels(name string, target any) []string {
	var warnings []string
	v := reflect.ValueOf(target)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return warnings
	}
	walkFields(name, v, &warnings)
	return warnings
}

func walkFields(prefix string, v reflect.Value, warnings *[]string) {
	t := v.Type()
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		fv := v.Field(i)

		path := fmt.Sprintf("%s.%s", prefix, field.Name)

		switch fv.Kind() {
		case reflect.String:
			if fv.String() == "" {
				*warnings = append(*warnings, fmt.Sprintf("[%s] missing: %s", prefix, field.Name))
			}
		case reflect.Struct:
			walkFields(path, fv, warnings)
		case reflect.Pointer:
			if !fv.IsNil() && fv.Elem().Kind() == reflect.Struct {
				walkFields(path, fv.Elem(), warnings)
			}
		}
	}
}
