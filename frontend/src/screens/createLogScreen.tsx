import { useState, useEffect, useRef } from 'react';
import { View, TextInput, Platform, StyleSheet, TouchableOpacity, Text, useColorScheme, Keyboard} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker';
import { TappableRatingDots } from '@/components/ui/RatingDots';
import { Toggle } from '@/components/ui/Toggle';
import { Colors, Fonts } from '@/constants/theme';

type Props = {
    id: string;
    initialRating?: number;
    style: object;
    reviewText: string;
    date: Date;
    rewatch: boolean;
    onRatingChange?: (value: number) => void;
    onRatingSetChange?: (isSet: boolean) => void;
    onWatchedChange?: (watched: boolean) => void;
    onLikedChange?: (liked: boolean) => void;
    onWatchListChange?: (inWatchList: boolean) => void;
    onReviewTextChange: (text: string) => void;
    onDateChange: (date: Date) => void;
}

function formatDateLabel(date: Date) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CreateLogScreen(
    {
    id,
    initialRating,
    style,
    onRatingChange,
    onRatingSetChange,
    rewatch,
    onReviewTextChange,
    onDateChange,
    onWatchedChange,
    onWatchListChange,
    reviewText,
    date
    }: Props){
    const theme = Colors[useColorScheme() ?? 'light'];

    const [rating, setRating] = useState<number>(initialRating ?? 0);
    const [watchList, setWatchList] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [ratingIsSet, setRatingIsSet] = useState(initialRating != null && initialRating > 0);
    const [reviewFocused, setReviewFocused] = useState(false);
    const reviewInputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (initialRating !== undefined) {
            setRating(initialRating);
        }
    }, [initialRating]);

    function handleRatingPress(value: number) {
        setRating(value);
        onRatingChange?.(value);
        if (!ratingIsSet) {
            setRatingIsSet(true);
            onRatingSetChange?.(true);
        }
    }

    // Web has no native DateTimePicker implementation (it renders null there
    // — see @react-native-community/datetimepicker's platform-less fallback),
    // so the date row opens a plain HTML date input on web instead.
    function handleWebDateChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value;
        if (!value) return;
        onDateChange(new Date(value));
    }

    function handleWatchListToggle(next: boolean) {
        setWatchList(next);
        onWatchListChange?.(next);
    }

    return (
        <View style={style}>
            <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                    I watched this on
                </Text>
                {Platform.OS === 'web' ? (
                    <View style={[styles.dateRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                        <input
                            type="date"
                            value={date.toISOString().split('T')[0]}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={handleWebDateChange}
                            style={webDateInputStyle(theme.text)}
                        />
                    </View>
                ) : (
                    <>
                        <TouchableOpacity
                            style={[styles.dateRow, { borderColor: theme.border, backgroundColor: theme.surface }]}
                            onPress={() => setShowPicker(true)}
                        >
                            <Text style={{ color: theme.text, fontFamily: Fonts?.sansSemiBold, fontVariant: ['tabular-nums'] }}>
                                {formatDateLabel(date)}
                            </Text>
                        </TouchableOpacity>
                        {showPicker && (
                            <DateTimePicker
                                value={date}
                                mode="date"
                                maximumDate={new Date()}
                                onChange={(event, selectedDate) => {
                                    setShowPicker(Platform.OS === 'ios');
                                    if (selectedDate) {
                                        onDateChange(selectedDate);
                                    }
                                }}
                            />
                        )}
                    </>
                )}
            </View>

            <View style={[styles.field, styles.rateBlock]}>
                <Text style={[styles.fieldLabel, styles.centerLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                    your rating
                </Text>
                <TappableRatingDots value={rating} onChange={handleRatingPress} />
                <Text style={[styles.rateCaption, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                    {rating > 0 ? `${rating} out of 5` : 'Tap a dot to rate'}
                </Text>
            </View>

            <View style={styles.field}>
                <View style={styles.reviewLabelRow}>
                    <Text style={[styles.fieldLabel, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                        review <Text style={{ opacity: 0.7 }}>optional</Text>
                    </Text>
                    {reviewFocused && (
                        <TouchableOpacity onPress={() => reviewInputRef.current?.blur()}>
                            <Text style={[styles.doneLabel, { color: theme.accent, fontFamily: Fonts?.sansSemiBold }]}>
                                Done
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TextInput
                    ref={reviewInputRef}
                    value={reviewText}
                    placeholder="What stood out about this one?"
                    placeholderTextColor={theme.muted}
                    onChangeText={onReviewTextChange}
                    onFocus={() => setReviewFocused(true)}
                    onBlur={() => setReviewFocused(false)}
                    multiline
                    returnKeyType="none"
                    onSubmitEditing={Keyboard.dismiss}
                    style={[
                        styles.reviewBox,
                        { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text, fontFamily: Fonts?.sans },
                    ]}
                />
                <Text style={[styles.charCount, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                    {reviewText.length} characters
                </Text>
            </View>

            <View style={[styles.toggleRow, { borderColor: theme.border }]}>
                <View>
                    <Text style={{ color: theme.text, fontFamily: Fonts?.sansMedium }}>Rewatch</Text>
                    <Text style={[styles.toggleSub, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                        You've seen this one before
                    </Text>
                </View>
                <Toggle value={rewatch} onChange={(next) => onWatchedChange?.(next)} />
            </View>
            <View style={[styles.toggleRow, styles.toggleRowLast, { borderColor: theme.border }]}>
                <View>
                    <Text style={{ color: theme.text, fontFamily: Fonts?.sansMedium }}>Add to watchlist</Text>
                    <Text style={[styles.toggleSub, { color: theme.muted, fontFamily: Fonts?.sans }]}>
                        Keep it queued after this log
                    </Text>
                </View>
                <Toggle value={watchList} onChange={handleWatchListToggle} />
            </View>
        </View>
    );
}

function webDateInputStyle(color: string) {
    return {
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 14,
        fontWeight: 600,
        color,
        width: '100%',
    } as const;
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 10,
  },
  reviewLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  doneLabel: {
    fontSize: 13,
    marginBottom: 10,
  },
  centerLabel: {
    textAlign: 'center',
  },
  dateRow: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rateBlock: {
    alignItems: 'center',
  },
  rateCaption: {
    fontSize: 13,
    marginTop: 10,
  },
  reviewBox: {
    borderWidth: 1,
    borderRadius: 3,
    padding: 14,
    minHeight: 120,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  toggleRowLast: {
    borderBottomWidth: 1,
    marginBottom: 24,
  },
  toggleSub: {
    fontSize: 12,
    marginTop: 2,
  },
})
