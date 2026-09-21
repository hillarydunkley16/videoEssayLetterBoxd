import { useEffect, useRef, useState } from 'react'
import { SearchBar } from '@rneui/themed'
import { router, useGlobalSearchParams, usePathname } from 'expo-router'
import { Colors, Fonts } from '@/constants/theme'

// Shared top-nav search field for both WebNav and MobileTopNav. It lives
// outside the (tabs)/search screen's render tree, so it drives that
// screen's results through route params rather than local state: `q`
// updates live as the user types (SearchScreen debounces its own DB filter
// off of it), and `submittedAt` only bumps on Enter/submit, which is
// SearchScreen's signal to run the slower DB + YouTube search.
export function SearchField({
  theme,
  style,
}: {
  theme: (typeof Colors)['light']
  style?: object
}) {
  const pathname = usePathname()
  const [search, setSearch] = useState('')
  const inputRef = useRef<any>(null)
  // The mobile Log tab navigates here with a fresh `focus` value (a timestamp) each
  // tap, so this input — which lives outside the search screen — grabs the keyboard.
  const { focus } = useGlobalSearchParams<{ focus?: string }>()

  useEffect(() => {
    if (focus) inputRef.current?.focus()
  }, [focus])

  const pushQuery = (query: string, extra?: Record<string, string>) => {
    const params = { q: query, ...extra }
    if (pathname.includes('search')) {
      router.setParams(params)
    } else {
      router.push({ pathname: '/(tabs)/search', params })
    }
  }

  const handleChangeText = (text: string) => {
    setSearch(text)
    pushQuery(text.trim())
  }

  const handleSubmit = () => {
    const query = search.trim()
    if (!query) return
    pushQuery(query, { submittedAt: String(Date.now()) })
  }

  return (
    <SearchBar
      ref={inputRef}
      placeholder="Search a video essay…"
      onFocus={() => pushQuery(search.trim())}
      onSubmitEditing={handleSubmit}
      value={search}
      onChangeText={handleChangeText}
      containerStyle={[styles.container, style]}
      inputContainerStyle={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
      inputStyle={[styles.input, { color: theme.text, fontFamily: Fonts?.sans }]}
      placeholderTextColor={theme.muted}
      searchIcon={{ type: 'material', name: 'search', size: 18, color: theme.muted }}
      clearIcon={{ type: 'material', name: 'clear', size: 18, color: theme.muted }}
    />
  )
}

const styles = {
  container: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 0,
  },
  inputContainer: {
    borderRadius: 2,
    borderWidth: 1,
    height: 36,
  },
  input: {
    fontSize: 13,
  },
} as const
