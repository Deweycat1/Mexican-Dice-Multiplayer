import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  options: number[];
  onCancel: () => void;
  onSelect: (claim: number) => void;
  canShowSocial?: boolean;
  onShowSocial?: () => void;
};

const formatClaim = (value: number) => {
  if (value === 21) return '21 (Mexican 🌮)';
  if (value === 31) return '31 (Reverse)';
  if (value === 41) return '41 (Social)';
  const hi = Math.floor(value / 10);
  const lo = value % 10;
  return `${hi}${lo}`;
};

export default function BluffModal({ visible, options, onCancel, onSelect, canShowSocial, onShowSocial }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.heading}>Choose your claim</Text>
          <Text style={styles.subtle}>
            Select a legal claim. You can now match or beat the previous claim. 21 and 31 are always available. 41 must be shown, not bluffed.
          </Text>

          <View style={styles.optionList}>
            {options.map((value) => (
              <Pressable
                key={value}
                style={({ pressed }) =>
                  StyleSheet.flatten([styles.option, pressed && styles.optionPressed])
                }
                onPress={() => onSelect(value)}
              >
                <Text style={styles.optionLabel}>{formatClaim(value)}</Text>
              </Pressable>
            ))}
          </View>

          {canShowSocial && (
            <Pressable
              style={({ pressed }) =>
                StyleSheet.flatten([
                  styles.option,
                  styles.socialOption,
                  pressed && styles.optionPressed,
                ])
              }
              onPress={onShowSocial}
            >
              <Text style={styles.optionLabel}>Show 41 (Social) — Reset Round</Text>
            </Pressable>
          )}

          <Pressable style={styles.cancel} onPress={onCancel}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#113b2b',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heading: { color: '#fff', fontWeight: '800', fontSize: 20 },
  subtle: { color: '#cfeee2', marginTop: 6 },
  optionList: { marginTop: 16 },
  option: {
    backgroundColor: '#1a5a40',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  optionPressed: {
    backgroundColor: '#236f51',
  },
  optionLabel: { color: '#fff', fontWeight: '700', fontSize: 18, textAlign: 'center' },
  socialOption: {
    backgroundColor: '#26775a',
  },
  cancel: {
    marginTop: 14,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelLabel: {
    color: '#cfeee2',
    fontWeight: '600',
    fontSize: 15,
  },
});
