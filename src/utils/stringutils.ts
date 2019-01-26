/** asserts whether the target is in range of low and high bytes, inclusive. */ 
export function is_in_range(target: string | undefined, low: string | undefined, high: string | undefined) {
  // return false, if nil, because these throws an error if we index on it
  if (target === undefined || low === undefined || high === undefined) {
    return false
  }

  // return false, if empty, because comparing a nil with a number value is an error from (""):byte() returning nil
  if (target === "" || low === "" || high === "") {
    return false
  }

  return (low.charCodeAt(0) <= target.charCodeAt(0)) && (high.charCodeAt(0) >= target.charCodeAt(0))
}

export function is_lowercase(t: string | undefined) {
  return is_in_range(t, "a", "z")
}

export function is_uppercase(t: string | undefined) {
  return is_in_range(t, "A", "Z")
}

export function is_letter(t: string | undefined) {
  return is_uppercase(t)
      || is_lowercase(t)
}

export function is_digit(t: string | undefined) {
  return is_in_range(t, "0", "9")
}