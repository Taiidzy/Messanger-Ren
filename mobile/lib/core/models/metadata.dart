class Metadata {
  final int size;
  final String nonce;
  final int fileId;
  final String filename;
  final String mimetype;
  final DateTime fileCreationDate;

  Metadata({
    required this.size,
    required this.nonce,
    required this.fileId,
    required this.filename,
    required this.mimetype,
    required this.fileCreationDate,
  });

  factory Metadata.fromJson(Map<String, dynamic> json) => Metadata(
    size: json["size"],
    nonce: json["nonce"],
    fileId: json["file_id"],
    filename: json["filename"],
    mimetype: json["mimetype"],
    fileCreationDate: DateTime.parse(json["file_creation_date"]),
  );

  Map<String, dynamic> toJson() => {
    "size": size,
    "nonce": nonce,
    "file_id": fileId,
    "filename": filename,
    "mimetype": mimetype,
    "file_creation_date": fileCreationDate.toIso8601String(),
  };
}