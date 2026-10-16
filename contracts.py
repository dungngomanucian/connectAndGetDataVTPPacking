
SESSION = {
    'id': None, 'tracking_code': None, 'status': None, 'table_id': None,
    'table_code': None, 'table_name': None, 'table_type': None,
    'started_at': None, 'ended_at': None, 'end_reason': None,
    'processing_status': None, 'video_available': None, 'snapshot_available': None,
    'consecutive_session_count': None, 'camera_count': None, 'thumbnail_url': None,
}
USER = {'id': None, 'username': None, 'full_name': None, 'role': None, 'enabled': None}
TABLE = {'id': None, 'code': None, 'name': None, 'enabled': None, 'table_type': None,
         'status': None, 'activity': None, 'current_session': SESSION,
         'cameras': {'overview': {'enabled': None, 'webrtc_url': None}, 'detail': {'enabled': None, 'webrtc_url': None}}}
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

WAREHOUSE_CHOICE = {'id': None, 'name': None, 'enabled': None}
WAREHOUSE_PAGE = {'items': [WAREHOUSE_CHOICE], 'total': None, 'limit': None, 'offset': None}
REPORT_WAREHOUSE = {'id': None, 'code': None, 'name': None,
                    'tables': [{'id': None, 'code': None, 'name': None, 'table_type': None}]}
REPORT_SUMMARY = {'orders': None, 'videos': None,
                  'daily': [{'date': None, 'orders': None, 'videos': None}],
                  'tables': [{'table_id': None, 'table_code': None, 'table_name': None,
                              'table_type': None, 'warehouse_id': None, 'warehouse_name': None,
                              'orders': None, 'videos': None}]}

WAREHOUSE_RECORD = {key: None for key in ('id', 'created_at', 'code', 'name', 'enabled', 'version', 'province', 'address', 'updated_at', 'sort_order')}
WAREHOUSE_LIST = {'items': [{**WAREHOUSE_RECORD, 'camera_total': None, 'camera_enabled': None, 'status': None}], 'total': None, 'limit': None, 'offset': None}
WAREHOUSE_DESKS = {'id': None, 'code': None, 'name': None, 'enabled': None,
                   'tables': [{'id': None, 'code': None, 'name': None, 'table_type': None,
                               'enabled': None, 'status': None, 'activity': None,
                               'current_session': {'id': None, 'tracking_code': None, 'status': None}}]}
DELETED = {'id': None, 'deleted': None}

AUDIO_ASSET = {key: None for key in ('event_type', 'version', 'configured', 'filename', 'media_type', 'duration_seconds', 'size_bytes')}
AUDIO_SETTINGS = {'assets': {'start': AUDIO_ASSET, 'end': AUDIO_ASSET}}
SESSION_TIMEOUT = {'version': None, 'max_session_seconds': None, 'max_session_minutes': None}


def project(value, schema):

    if value is None:
        return None
    if schema is None:
        return value if isinstance(value, (str, bool, int, float)) else None
    if isinstance(schema, list):
        return [project(item, schema[0]) for item in value] if isinstance(value, list) else []
    if not isinstance(value, dict):
        return {}
    return {key: project(value[key], child) for key, child in schema.items() if key in value}
