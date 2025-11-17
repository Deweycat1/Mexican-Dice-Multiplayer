import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Speaker = 'user' | 'rival';

interface DialogBannerProps {
  speaker: Speaker;
  text: string;
}

export default function DialogBanner({ speaker, text }: DialogBannerProps) {
  return (
    <View style={styles.dialogContainer}>
      <View style={styles.dialogSpeaker}>
        <Text style={styles.dialogSpeakerEmoji}>
          {speaker === 'user' ? '😇' : '👹'}
        </Text>
        <Text style={[
          styles.dialogSpeakerName,
          speaker === 'user' ? styles.userSpeaker : styles.rivalSpeaker
        ]}>
          {speaker === 'user' ? 'You' : 'The Rival'}
        </Text>
      </View>

      <View style={styles.dialogTextWrapper}>
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          style={styles.dialogText}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dialogContainer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 94, 56, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(224, 181, 12, 0.3)',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 8,
    marginBottom: 4,
  },
  dialogSpeaker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    minWidth: 80,
  },
  dialogSpeakerEmoji: {
    fontSize: 22,
    marginRight: 6,
  },
  dialogSpeakerName: {
    fontWeight: '800',
    fontSize: 13,
  },
  userSpeaker: {
    color: '#6BFF89',
  },
  rivalSpeaker: {
    color: '#FF6B6B',
  },
  dialogTextWrapper: {
    flex: 1,
  },
  dialogText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
