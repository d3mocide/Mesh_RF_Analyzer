import csv
import io
# import simplekml # If we had it, but let's do manual XML to avoid dependencies if possible, or use a simple template.
# simplekml is better but requires install. Let's write manual XML for KML to keep container light if simplekml isn't installed.
# We checked requirements earlier? No. Let's assume manual KML generation for now.

def generate_csv(results):
    """
    Generate CSV string from results list.
    results: list of dicts {lat, lon, score, elevation, ...}
    """
    output = io.StringIO()
    # Define fields
    fields = ["rank", "score", "lat", "lon", "elevation", "prominence", "fresnel", "description"]
    
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    
    for i, res in enumerate(results):
        row = {
            "rank": i + 1,
            "score": res.get("score", 0),
            "lat": res.get("lat"),
            "lon": res.get("lon"),
            "elevation": res.get("elevation", 0),
            "prominence": res.get("prominence", 0),
            "fresnel": res.get("fresnel", 0),
            "description": f"Candidate #{i+1}"
        }
        writer.writerow(row)
        
    return output.getvalue()

def generate_kml(results, name="RF Scan Results"):
    """
    Generate KML string manually.
    """
    kml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        '<Document>',
        f'<name>{name}</name>',
        '<Style id="highScore"><IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon></IconStyle></Style>',
        '<Style id="medScore"><IconStyle><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href></Icon></IconStyle></Style>',
        '<Style id="lowScore"><IconStyle><scale>0.8</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon></IconStyle></Style>'
    ]
    
    for i, res in enumerate(results):
        score = res.get("score", 0)
        style = "#lowScore"
        if score > 80: style = "#highScore"
        elif score > 50: style = "#medScore"
        
        kml.append('<Placemark>')
        kml.append(f'<name>#{i+1} (Score: {score})</name>')
        kml.append(f'<styleUrl>{style}</styleUrl>')
        kml.append('<description>')
        kml.append(f'<![CDATA['
                   f'<b>Score:</b> {score}<br/>'
                   f'<b>Elevation:</b> {res.get("elevation",0):.1f}m<br/>'
                   f'<b>Prominence:</b> {res.get("prominence",0):.1f}m<br/>'
                   f'<b>Fresnel Factor:</b> {res.get("fresnel",0):.2f}'
                   f']]>')
        kml.append('</description>')
        kml.append('<Point>')
        kml.append(f'<coordinates>{res["lon"]},{res["lat"]},{res.get("elevation",0)}</coordinates>')
        kml.append('</Point>')
        kml.append('</Placemark>')
        
    kml.append('</Document>')
    kml.append('</kml>')
    
    return "\n".join(kml)
