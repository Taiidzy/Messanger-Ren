class Envelope {
  final String iv;
  final String key;
  final String ephemPubKey;

  Envelope({
    required this.iv,
    required this.key,
    required this.ephemPubKey,
  });

  factory Envelope.fromJson(Map<String, dynamic> json) => Envelope(
    iv: json["iv"],
    key: json["key"],
    ephemPubKey: json["ephemPubKey"],
  );

  Map<String, dynamic> toJson() => {
    "iv": iv,
    "key": key,
    "ephemPubKey": ephemPubKey,
  };
}