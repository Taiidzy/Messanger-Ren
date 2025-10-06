String getInitials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty) return '?';
  final initials =
      parts.length == 1 ? parts[0][0] : '${parts[0][0]}${parts[1][0]}';
  return initials.toUpperCase();
}
