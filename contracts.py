"""Public view models only. No recording, detection or rendering logic belongs here."""
SESSION = {
    'id': None, 'tracking_code': None, 'status': None, 'table_id': None,
    'table_code': None, 'table_name': None, 'table_type': None,
    'started_at': None, 'ended_at': None, 'end_reason': None,
    'processing_status': None, 'video_available': None, 'snapshot_available': None,
    'consecutive_session_count': None, 'camera_count': None, 'thumbnail_url': None,
}
USER = {'id': None, 'username': None, 'full_name': None, 'role': None, 'enabled': None}
TABLE = {'id': None, 'code': None, 'name': None, 'enabled': None, 'table_type': None,
         'status': None, 'activity': None, 'current_session': SESSION}
DASHBOARD = {'warehouses': [{'id': None, 'code': None, 'name': None, 'tables': [TABLE]}]}
PAGE = {'items': [SESSION], 'total': None, 'limit': None, 'offset': None}
NEARBY = {**PAGE, 'seed': SESSION}
CLIP = {'id': None, 'lens_type': None, 'status': None, 'urls': [None],
        'is_pip': None, 'is_complex': None}
PLAYBACK = {'session': SESSION, 'record_detail_video': None, 'encode_pip_video': None,
            'clips': [CLIP], 'download_clips': [CLIP], 'snapshots': [CLIP]}
JOB = {'id': None, 'version': None, 'state': None}
REPRESENTATIVE = {'job': JOB, 'source_count': None, 'automatic_state': None, 'group_revision': None}
TIMELINE = {'output_start': None, 'output_end': None, 'wall_start': None, 'wall_end': None}
OUTPUTS = {'outputs': [{'camera': None, 'labels': [None], 'url': None,
                        'download_url': None, 'timeline': [TIMELINE]}]}
LOGIN = {'access_token': None, 'token_type': None, 'user': USER}


def project(value, schema):
    """Drop all undeclared upstream fields, including future configuration fields."""
    if value is None:
        return None
    if schema is None:
        return value if isinstance(value, (str, bool, int, float)) else None
    if isinstance(schema, list):
        return [project(item, schema[0]) for item in value] if isinstance(value, list) else []
    if not isinstance(value, dict):
        return {}
    return {key: project(value[key], child) for key, child in schema.items() if key in value}
