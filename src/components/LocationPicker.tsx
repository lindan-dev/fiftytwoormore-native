// Ported from src/components/LocationPicker.tsx. The only genuinely new
// native piece in the whole migration: Leaflet (web-only) is replaced with
// react-native-maps + expo-location. Reverse geocoding call (BigDataCloud)
// is identical to the web version - it's a plain fetch, works the same here.
import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import * as Location from "expo-location";
import { MapPin, X, Map as MapIcon } from "lucide-react-native";
import { countryFlag } from "../lib/countryFlag";
import { colors, radius, spacing } from "../theme/colors";

export interface LocationValue {
  label: string;
  country?: string | null; // ISO-2 code
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  value: LocationValue | null;
  onChange: (val: LocationValue | null) => void;
}

async function reverseGeocode(latitude: number, longitude: number): Promise<LocationValue> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    const data = await res.json();
    const city: string = data.city || data.locality || data.principalSubdivision || "";
    const country: string = data.countryName || "";
    const code: string = data.countryCode || "";
    const label = [city, country].filter(Boolean).join(", ") || "Pinned location";
    return { label, country: code || null, lat: latitude, lng: longitude };
  } catch {
    return {
      label: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
      lat: latitude,
      lng: longitude,
    };
  }
}

export default function LocationPicker({ value, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const handleUseLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location blocked", "Allow location access or pick on the map.");
        setLoading(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      const v = await reverseGeocode(latitude, longitude);
      onChange(v);
    } catch {
      Alert.alert("Couldn't fetch place", "Try again or pick on the map.");
    } finally {
      setLoading(false);
    }
  };

  const handleMapPick = async (lat: number, lng: number) => {
    setLoading(true);
    const v = await reverseGeocode(lat, lng);
    onChange(v);
    setLoading(false);
    setMapOpen(false);
  };

  return (
    <View>
      {value ? (
        <View style={styles.row}>
          <View style={styles.chip}>
            <MapPin size={14} color={colors.foreground} />
            <Text style={styles.chipText}>
              {countryFlag(value.country)} {value.label}
            </Text>
            <Pressable onPress={() => onChange(null)} accessibilityLabel="Clear location">
              <X size={12} color={colors.foreground} />
            </Pressable>
          </View>
          <Pressable style={styles.outlineButton} onPress={handleUseLocation} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <MapPin size={16} color={colors.foreground} />
            )}
            <Text style={styles.outlineButtonText}>Use my location</Text>
          </Pressable>
          <Pressable style={styles.outlineButton} onPress={() => setMapOpen(true)}>
            <MapIcon size={16} color={colors.foreground} />
            <Text style={styles.outlineButtonText}>Pick on map</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable style={styles.outlineButton} onPress={handleUseLocation} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <MapPin size={16} color={colors.foreground} />
            )}
            <Text style={styles.outlineButtonText}>Use my location</Text>
          </Pressable>
          <Pressable style={styles.outlineButton} onPress={() => setMapOpen(true)}>
            <MapIcon size={16} color={colors.foreground} />
            <Text style={styles.outlineButtonText}>Pick on map</Text>
          </Pressable>
        </View>
      )}

      <MapPickerModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        initial={value && value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null}
        onPick={handleMapPick}
      />
    </View>
  );
}

function MapPickerModal({
  open,
  onClose,
  initial,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  initial: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(initial);

  const handlePress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPos({ lat: latitude, lng: longitude });
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Pick a location</Text>
          <Pressable onPress={onClose}>
            <X size={22} color={colors.foreground} />
          </Pressable>
        </View>

        <MapView
          style={styles.map}
          initialRegion={{
            latitude: initial?.lat ?? 20,
            longitude: initial?.lng ?? 0,
            latitudeDelta: initial ? 0.5 : 60,
            longitudeDelta: initial ? 0.5 : 60,
          }}
          onPress={handlePress}
        >
          {pos && <Marker coordinate={{ latitude: pos.lat, longitude: pos.lng }} />}
        </MapView>

        <Text style={styles.modalHint}>Tap anywhere on the map to drop a pin.</Text>

        <View style={styles.modalFooter}>
          <Pressable style={styles.ghostButton} onPress={onClose}>
            <Text style={styles.ghostButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, !pos && styles.primaryButtonDisabled]}
            disabled={!pos}
            onPress={() => pos && onPick(pos.lat, pos.lng)}
          >
            <Text style={styles.primaryButtonText}>Use this spot</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.primary + "1a",
    borderWidth: 1,
    borderColor: colors.primary + "33",
  },
  chipText: {
    fontSize: 13,
    color: colors.foreground,
  },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outlineButtonText: {
    fontSize: 13,
    color: colors.foreground,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xxl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
  },
  map: {
    flex: 1,
  },
  modalHint: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  ghostButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  ghostButtonText: {
    color: colors.mutedForeground,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
});
