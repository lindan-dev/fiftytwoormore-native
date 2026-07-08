// Ported from src/components/LocationPicker.tsx. The only genuinely new
// native piece in the whole migration: Leaflet (web-only) is replaced with
// react-native-maps + expo-location. Reverse geocoding call (BigDataCloud)
// is identical to the web version - it's a plain fetch, works the same here.
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import * as Location from "expo-location";
import { MapPin, X, Map as MapIcon, Search } from "lucide-react-native";
import { supabase } from "../integrations/supabase/client";
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

// Ticket 4 (BACKLOG.md): quick-select chips for the person's own most-used
// locations - individual per user, not shared with their partner, so this
// deliberately queries activities filtered to the current user only, not
// the couple-wide activity feed the rest of the app shows.
// Location labels are formatted as "City, Country" (see reverseGeocode
// below) - the quick-pick chips only need the city part, paired with the
// flag, to stay compact enough for three to fit on one row.
function cityOnly(label: string): string {
  return label.split(",")[0].trim();
}

function useTopLocations(limit = 3) {
  const [topLocations, setTopLocations] = useState<LocationValue[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("activities")
        .select("location_label, location_country, location_lat, location_lng")
        .eq("user_id", user.id)
        .not("location_label", "is", null);

      if (error || !data) return;

      const counts = new Map<string, { value: LocationValue; count: number }>();
      for (const row of data) {
        if (!row.location_label) continue;
        const existing = counts.get(row.location_label);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(row.location_label, {
            count: 1,
            value: {
              label: row.location_label,
              country: row.location_country,
              lat: row.location_lat,
              lng: row.location_lng,
            },
          });
        }
      }

      const sorted = Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((entry) => entry.value);

      setTopLocations(sorted);
    })();
  }, [limit]);

  return topLocations;
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
  const topLocations = useTopLocations(3);

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
        <View>
          {topLocations.length > 0 && (
            <View style={styles.quickRow}>
              {topLocations.map((loc, i) => (
                <Pressable key={i} style={styles.quickChip} onPress={() => onChange(loc)}>
                  <Text style={styles.quickChipText} numberOfLines={1}>
                    {countryFlag(loc.country)} {cityOnly(loc.label)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
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
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const mapRef = useRef<MapView>(null);

  const handlePress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPos({ lat: latitude, lng: longitude });
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(query.trim());
      if (results.length === 0) {
        Alert.alert("Not found", "Couldn't find that address. Try a different search, or tap the map directly.");
        return;
      }
      const { latitude, longitude } = results[0];
      setPos({ lat: latitude, lng: longitude });
      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        400,
      );
    } catch {
      Alert.alert("Search failed", "Couldn't search for that address right now. Try tapping the map directly.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
      <SafeAreaView style={styles.modalContainer} edges={["top"]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Pick a location</Text>
          <Pressable onPress={onClose}>
            <X size={22} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search for an address..."
            style={styles.searchInput}
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <Pressable style={styles.searchButton} onPress={handleSearch} disabled={searching}>
            {searching ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Search size={18} color={colors.primaryForeground} />}
          </Pressable>
        </View>

        <MapView
          ref={mapRef}
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

        <Text style={styles.modalHint}>Search for an address, or tap anywhere on the map to drop a pin.</Text>

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
      </SafeAreaView>
      </SafeAreaProvider>
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
  quickRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  quickChip: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.primary + "1a",
    borderWidth: 1,
    borderColor: colors.primary + "33",
  },
  quickChipText: {
    fontSize: 12,
    color: colors.foreground,
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
  },
  searchRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
