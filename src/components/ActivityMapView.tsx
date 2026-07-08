// New view for BACKLOG.md Ticket 5. One marker per activity that has
// location data (not grouped/clustered per the decision made) - if
// several activities were logged at the same place, they'll show as
// overlapping markers there, same as any standard map pin behavior.
import { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { colors, radius, spacing } from "../theme/colors";

interface Activity {
  id: string;
  activity_date: string;
  emoji?: string | null;
  notes?: string | null;
  location_label?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

export default function ActivityMapView({ activities }: { activities: Activity[] }) {
  const located = useMemo(
    () => activities.filter((a) => typeof a.location_lat === "number" && typeof a.location_lng === "number"),
    [activities],
  );

  const initialRegion = useMemo(() => {
    if (located.length === 0) {
      return { latitude: 20, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };
    }
    const lats = located.map((a) => a.location_lat as number);
    const lngs = located.map((a) => a.location_lng as number);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latitude = (minLat + maxLat) / 2;
    const longitude = (minLng + maxLng) / 2;
    // Pad the span so points near the edge aren't clipped, with a
    // sensible minimum zoom so a single location doesn't zoom in absurdly.
    const latitudeDelta = Math.max((maxLat - minLat) * 1.6, 0.5);
    const longitudeDelta = Math.max((maxLng - minLng) * 1.6, 0.5);
    return { latitude, longitude, latitudeDelta, longitudeDelta };
  }, [located]);

  if (located.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No locations logged yet</Text>
        <Text style={styles.emptyText}>
          Activities you log with a location will show up here on the map.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {located.map((activity) => (
          <Marker
            key={activity.id}
            coordinate={{ latitude: activity.location_lat as number, longitude: activity.location_lng as number }}
          >
            <View style={styles.markerBadge}>
              <Text style={styles.markerEmoji}>{activity.emoji || "❤️"}</Text>
            </View>
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutDate}>
                  {new Date(activity.activity_date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
                {activity.location_label && <Text style={styles.calloutLocation}>{activity.location_label}</Text>}
                {activity.notes && <Text style={styles.calloutNotes}>{activity.notes}</Text>}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    overflow: "hidden",
    height: 480,
  },
  map: {
    flex: 1,
  },
  markerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  markerEmoji: {
    fontSize: 18,
  },
  callout: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.sm,
    minWidth: 140,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calloutDate: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
  },
  calloutLocation: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  calloutNotes: {
    fontSize: 12,
    color: colors.foreground,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
