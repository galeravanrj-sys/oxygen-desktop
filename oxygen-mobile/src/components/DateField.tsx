import { Platform } from "react-native";
import { Button } from "react-native-paper";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Field } from "./ui";
import { localDate } from "../lib/dataValidation";
export function DateField({
  label,
  value,
  onChange,
  time = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  time?: boolean;
}) {
  return (
    <>
      <Field label={label} value={value} onChangeText={onChange} />
      {!!(Platform.OS === "android") && (
        <Button
          icon="calendar"
          onPress={() => {
            const initial = new Date(
              value.includes("T") ? value : value + "T12:00:00",
            );
            DateTimePickerAndroid.open({
              value: Number.isFinite(initial.getTime()) ? initial : new Date(),
              mode: "date",
              onChange: (_event, date) => {
                if (!date) return;
                if (!time) {
                  onChange(localDate(date));
                  return;
                }
                DateTimePickerAndroid.open({
                  value: date,
                  mode: "time",
                  onChange: (_e, chosen) => {
                    if (chosen)
                      onChange(
                        `${localDate(date)}T${String(chosen.getHours()).padStart(2, "0")}:${String(chosen.getMinutes()).padStart(2, "0")}`,
                      );
                  },
                });
              },
            });
          }}
        >
          Choose {time ? "date and time" : "date"}
        </Button>
      )}
    </>
  );
}
