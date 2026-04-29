import React, {useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {usePreferencesStore} from '../preferences-state';
import {fonts, tokens} from '../theme';
import {Toggle} from './atoms/Toggle';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function PreferencesSheet({visible, onClose}: Props) {
  const prefs = usePreferencesStore();

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Pressable style={styles.dismissCatcher} onPress={onClose} />
      <View style={styles.backdrop} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Preferences</Text>
            <Pressable onPress={onClose} style={styles.close}>
              <Text style={styles.closeLabel}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            <SectionHeader label="Server" />
            <Field
              label="Server name"
              hint="Shown to phones during pairing"
              control={
                <TextInput
                  defaultValue={prefs.serverName}
                  style={styles.input}
                  onSubmitEditing={e =>
                    prefs.set('serverName', e.nativeEvent.text)
                  }
                  placeholderTextColor={tokens.textDim}
                />
              }
            />
            <Field
              label="Port"
              control={
                <View style={styles.inlineRow}>
                  <TextInput
                    defaultValue={prefs.port === 0 ? '' : String(prefs.port)}
                    keyboardType="number-pad"
                    placeholder="auto"
                    placeholderTextColor={tokens.textDim}
                    style={[styles.input, {width: 84, fontFamily: fonts.mono}]}
                    onSubmitEditing={e => {
                      const next = parseInt(e.nativeEvent.text, 10);
                      void prefs.set('port', Number.isFinite(next) ? next : 0);
                    }}
                  />
                  <View style={styles.checkbox}>
                    <Toggle
                      on={prefs.port === 0}
                      onChange={autoPick =>
                        prefs.set('port', autoPick ? 0 : 49827)
                      }
                    />
                    <Text style={styles.checkboxLabel}>Auto-pick</Text>
                  </View>
                </View>
              }
            />
            <Field
              label="Discoverable"
              hint="Advertise via Bonjour"
              control={
                <Toggle
                  on={prefs.discoverable}
                  onChange={v => prefs.set('discoverable', v)}
                />
              }
              last
            />

            <SectionHeader label="Pointer" />
            <Field
              label="Sensitivity"
              control={
                <SensitivitySlider
                  value={prefs.sensitivity}
                  onChange={v => prefs.set('sensitivity', v)}
                />
              }
            />
            <Field
              label="Natural scroll"
              hint="Content follows fingers"
              control={
                <Toggle
                  on={prefs.naturalScroll}
                  onChange={v => prefs.set('naturalScroll', v)}
                />
              }
            />
            <Field
              label="Tap to click"
              control={
                <Toggle
                  on={prefs.tapToClick}
                  onChange={v => prefs.set('tapToClick', v)}
                />
              }
              last
            />

            <SectionHeader label="Launch" />
            <Field
              label="Open at login"
              control={
                <Toggle
                  on={prefs.openAtLogin}
                  onChange={v => prefs.set('openAtLogin', v)}
                />
              }
            />
            <Field
              label="Show menu bar icon"
              control={
                <Toggle
                  on={prefs.showMenuBarIcon}
                  onChange={v => prefs.set('showMenuBarIcon', v)}
                />
              }
            />
            <Field
              label="Hide dock icon"
              hint="Run as a status-only app"
              control={
                <Toggle
                  on={prefs.hideDockIcon}
                  onChange={v => prefs.set('hideDockIcon', v)}
                />
              }
              last
            />
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.done} onPress={onClose}>
              <Text style={styles.doneLabel}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function SectionHeader({label}: {label: string}) {
  return <Text style={styles.section}>{label}</Text>;
}

function Field({
  label,
  hint,
  control,
  last = false,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.field, !last && styles.fieldBorder]}>
      <View style={styles.fieldLabel}>
        <Text style={styles.fieldLabelText}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      <View style={styles.fieldControl}>{control}</View>
    </View>
  );
}

function SensitivitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [local, setLocal] = useState(value);
  const min = 1;
  const max = 3;
  const ratio = (local - min) / (max - min);

  return (
    <View style={styles.sliderWrap}>
      <Text style={styles.sliderTick}>1×</Text>
      <Pressable
        style={styles.sliderTrack}
        onPress={e => {
          const layout = e.currentTarget;
          const x = e.nativeEvent.locationX;
          (layout as any).measure?.((_x: number, _y: number, width: number) => {
            const next = Math.min(
              max,
              Math.max(min, min + (x / width) * (max - min)),
            );
            setLocal(next);
            onChange(parseFloat(next.toFixed(1)));
          });
        }}>
        <View style={[styles.sliderFill, {width: `${ratio * 100}%`}]} />
        <View style={[styles.sliderThumb, {left: `${ratio * 100}%`}]} />
      </Pressable>
      <Text style={styles.sliderTick}>3×</Text>
      <Text style={styles.sliderValue}>{local.toFixed(1)}×</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  dismissCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,9,12,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: 540,
    maxHeight: '92%',
    backgroundColor: 'rgba(20,23,30,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  headerRow: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: -0.14,
    color: tokens.text,
  },
  close: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    color: tokens.textMid,
    fontSize: 11,
    lineHeight: 11,
  },
  body: {
    flex: 0,
  },
  section: {
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 20,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: tokens.textDim,
    borderTopWidth: 1,
    borderTopColor: tokens.divider,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 20,
    gap: 20,
  },
  fieldBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  fieldLabel: {
    width: 180,
    alignItems: 'flex-end',
  },
  fieldLabelText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: tokens.textHigh,
    textAlign: 'right',
  },
  fieldHint: {
    fontSize: 10.5,
    color: tokens.textDim,
    marginTop: 1,
    textAlign: 'right',
  },
  fieldControl: {
    flex: 1,
  },
  input: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 6,
    color: tokens.text,
    fontSize: 12.5,
    minWidth: 200,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 12,
    color: tokens.textMid,
  },
  sliderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 280,
  },
  sliderTick: {
    fontSize: 10.5,
    color: tokens.textDim,
  },
  sliderTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  sliderFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: tokens.accent,
  },
  sliderThumb: {
    position: 'absolute',
    top: -4,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#fff',
    transform: [{translateX: -5.5}],
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 1},
  },
  sliderValue: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: tokens.text,
    minWidth: 32,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  done: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
  },
  doneLabel: {
    color: '#0e1014',
    fontWeight: '500',
    fontSize: 12.5,
  },
});
