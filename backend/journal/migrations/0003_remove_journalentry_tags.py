from django.db import migrations


def remove_tags(apps, schema_editor):
    """Safely remove the `tags` column from `journal_journalentry` if it exists.

    This is a best-effort migration: it will attempt a backend-specific DROP COLUMN
    and for SQLite will try a recreate-copy approach if necessary. Any errors are
    swallowed so the migration does not fail on databases where the column is
    already absent or where DROP COLUMN is unsupported.
    """
    connection = schema_editor.connection
    table_name = 'journal_journalentry'
    try:
        with connection.cursor() as cursor:
            # get current columns (best-effort)
            try:
                cols_info = connection.introspection.get_table_description(cursor, table_name)
                cols = [c[0] for c in cols_info]
            except Exception:
                cols = []

            if 'tags' not in cols:
                return

            try:
                if connection.vendor == 'postgresql':
                    cursor.execute(f'ALTER TABLE {table_name} DROP COLUMN IF EXISTS tags;')
                elif connection.vendor == 'mysql':
                    cursor.execute(f'ALTER TABLE {table_name} DROP COLUMN IF EXISTS `tags`;')
                elif connection.vendor == 'sqlite':
                    # try simple DROP COLUMN (works on newer SQLite versions)
                    try:
                        cursor.execute(f'ALTER TABLE {table_name} DROP COLUMN tags;')
                    except Exception:
                        # Fallback: recreate table without the tags column (best-effort)
                        cursor.execute("PRAGMA foreign_keys=off;")
                        cursor.execute('BEGIN TRANSACTION;')
                        # fetch CREATE statement
                        cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}';")
                        row = cursor.fetchone()
                        if row and row[0]:
                            create_sql = row[0]
                            import re

                            # remove the tags column definition from CREATE TABLE statement
                            new_create = re.sub(r",\s*\"?tags\"?\s+[^,\)]+", '', create_sql, flags=re.IGNORECASE)
                            new_table = table_name + '__new'
                            cursor.execute(new_create.replace(table_name, new_table))
                            cols_no_tags = [c for c in cols if c != 'tags']
                            cols_csv = ', '.join([f'"{c}"' for c in cols_no_tags])
                            cursor.execute(f'INSERT INTO {new_table} ({cols_csv}) SELECT {cols_csv} FROM {table_name};')
                            cursor.execute(f'DROP TABLE {table_name};')
                            cursor.execute(f'ALTER TABLE {new_table} RENAME TO {table_name};')
                        cursor.execute('COMMIT;')
                        cursor.execute('PRAGMA foreign_keys=on;')
                else:
                    # Unknown backend — attempt generic DROP COLUMN and ignore failures
                    try:
                        cursor.execute(f'ALTER TABLE {table_name} DROP COLUMN tags;')
                    except Exception:
                        pass
            except Exception:
                # swallow any errors to keep migration safe
                return
    except Exception:
        return


class Migration(migrations.Migration):

    dependencies = [
        ('journal', '0002_remove_journalentry_content_and_more'),
    ]

    operations = [
        migrations.RunPython(remove_tags, reverse_code=migrations.RunPython.noop),
    ]
