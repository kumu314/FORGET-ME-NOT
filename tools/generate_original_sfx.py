import argparse
import hashlib
import io
import json
import math
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RATE = 22050
VERSION = 1
TAU = math.tau
RECIPES = {
    'hit': (0.20, 'impact', 'Short low triangle pitch fall and filtered impact noise'),
    'hit_heavy': (0.34, 'impact', 'Deep double impact with a low resonant tail'),
    'crit': (0.30, 'impact', 'Bright three-part strike over a short bass impact'),
    'hurt': (0.28, 'character', 'Two falling synthetic pulses, no human recording'),
    'death': (0.86, 'character', 'Descending three-note synthetic collapse'),
    'block': (0.32, 'impact', 'Inharmonic metal ring and a short contact transient'),
    'jump': (0.25, 'movement', 'Rising triangle chirp'),
    'land': (0.19, 'movement', 'Damped low contact and soft grit'),
    'footstep': (0.11, 'movement', 'Quiet two-layer contact tick'),
    'throw': (0.24, 'paper', 'Filtered air swoosh with an upward pitch trace'),
    'magic': (0.65, 'magic', 'Four-note bright memory sparkle'),
    'bark': (0.43, 'dog', 'Two pulse/formant/noise barks, entirely synthetic'),
    'bark_attack': (0.43, 'dog', 'Three rough low barks and a brief contact sound, synthetic'),
    'dog_hurt': (0.57, 'dog', 'Soft rising and falling synthetic whine, no animal recording'),
    'pickup': (0.28, 'magic', 'Quick ascending two-note triangle cue'),
    'bell': (1.15, 'environment', 'Three inharmonic exponentially decaying sine partials'),
    'thunder': (2.20, 'environment', 'Low-pass seeded noise rumble and low sine swell'),
    'rain': (4.00, 'environment', 'Circular filtered seeded noise, periodic modulation, seamless loop'),
    'egg': (0.72, 'interface', 'Original four-note discovery arpeggio'),
    'victory': (1.28, 'interface', 'Original six-note bright resolving phrase'),
    'typing': (0.04, 'interface', 'Very quiet short filtered tick'),
    'ui': (0.07, 'interface', 'Quiet short sine confirmation'),
    'checkpoint': (0.56, 'interface', 'Three-note upward checkpoint confirmation'),
    'paper': (0.38, 'paper', 'Three overlapping filtered paper rustles'),
    'door': (0.72, 'environment', 'Synthetic wood creak followed by a low closing contact'),
    'boss_roar': (0.90, 'boss', 'Low harmonic growl with filtered noise, no voice recording'),
    'boss_warn': (0.58, 'boss', 'Two dissonant warning pulses'),
    'boss_enter': (0.90, 'boss', 'Slow low chord arrival and impact'),
    'transition': (0.85, 'interface', 'Soft filtered wind sweep'),
    'heal': (0.70, 'magic', 'Gentle upward major arpeggio with a soft tail'),
    'mp_up': (0.42, 'magic', 'Three rising sine notes'),
    'mp_down': (0.38, 'magic', 'Three falling triangle notes'),
}


def seed_for(key):
    return int.from_bytes(hashlib.sha256(('until-the-end:sfx:v1:' + key).encode()).digest()[:8], 'big')


def envelope(elapsed, duration, attack, release, decay=0):
    rise = math.sin(min(1, elapsed / attack) * math.pi / 2) ** 2
    fall = math.sin(min(1, max(0, duration - elapsed) / release) * math.pi / 2) ** 2
    return rise * fall * math.exp(-decay * elapsed / duration)


class Sound:
    def __init__(self, key):
        self.key = key
        self.duration = RECIPES[key][0]
        self.samples = [0.0] * round(self.duration * RATE)
        self.rng = random.Random(seed_for(key))

    def tone(self, start, duration, frequency, end=None, volume=0.4, shape='sine', attack=0.006, release=0.03, decay=2):
        end = frequency if end is None else end
        sweep = math.log(end / frequency) / duration
        for index in range(round(start * RATE), min(len(self.samples), round((start + duration) * RATE))):
            elapsed = index / RATE - start
            if elapsed < 0:
                continue
            phase = TAU * frequency * (math.expm1(sweep * elapsed) / sweep if abs(sweep) > 1e-9 else elapsed)
            if shape == 'triangle':
                value = 2 / math.pi * math.asin(math.sin(phase))
            elif shape == 'pulse':
                value = (math.sin(phase) + math.sin(phase * 3) / 3 + math.sin(phase * 5) / 5) / 1.54
            else:
                value = math.sin(phase)
            self.samples[index] += volume * value * envelope(elapsed, duration, attack, release, decay)

    def noise(self, start, duration, volume=0.3, cutoff=1500, attack=0.008, release=0.04, decay=2):
        coefficient = 1 - math.exp(-TAU * cutoff / RATE)
        filtered = 0.0
        for index in range(round(start * RATE), min(len(self.samples), round((start + duration) * RATE))):
            elapsed = index / RATE - start
            if elapsed < 0:
                continue
            filtered += coefficient * (self.rng.uniform(-1, 1) - filtered)
            self.samples[index] += volume * filtered * envelope(elapsed, duration, attack, release, decay)

    def notes(self, pitches, spacing=0.09, duration=0.20, volume=0.25, shape='sine'):
        for index, pitch in enumerate(pitches):
            self.tone(index * spacing, duration, 440 * 2 ** ((pitch - 69) / 12), volume=volume, shape=shape, decay=2.5)

    def impact(self, start=0, heavy=False):
        self.tone(start, 0.22 if heavy else 0.12, 145 if heavy else 220, 42 if heavy else 65, 0.75, 'triangle', decay=3)
        self.noise(start, 0.17 if heavy else 0.09, 0.4, 1100 if heavy else 2200, decay=4)

    def bark(self, start, duration=0.14, low=False):
        self.tone(start, duration, 145 if low else 205, 75 if low else 115, 0.55, 'pulse', decay=1.4)
        self.tone(start, duration, 560, 430, 0.13, attack=0.012, decay=2)
        self.tone(start, duration, 970, 740, 0.07, attack=0.010, decay=3)
        self.noise(start, duration, 0.15, 1800, attack=0.01, decay=2)


def compose(key):
    sound = Sound(key)
    if key == 'hit':
        sound.impact()
    elif key == 'hit_heavy':
        sound.impact(heavy=True)
        sound.impact(0.045, heavy=True)
    elif key == 'crit':
        sound.impact()
        for frequency in [1350, 2170, 3180]:
            sound.tone(0, 0.24, frequency, volume=0.18, decay=5)
    elif key == 'hurt':
        sound.tone(0, 0.12, 370, 180, 0.4, 'pulse')
        sound.tone(0.11, 0.13, 270, 110, 0.28, 'pulse')
    elif key == 'death':
        sound.notes([55, 50, 43], 0.20, 0.36, 0.4, 'triangle')
        sound.noise(0.12, 0.65, 0.15, 650, decay=3)
    elif key == 'block':
        for frequency, volume in [(640, 0.35), (1031, 0.20), (1771, 0.12)]:
            sound.tone(0, 0.29, frequency, volume=volume, decay=5)
        sound.noise(0, 0.04, 0.3, 3600, release=0.02)
    elif key == 'jump':
        sound.tone(0, 0.22, 240, 700, 0.4, 'triangle', decay=1)
    elif key in ['land', 'footstep']:
        sound.tone(0, 0.085, 155, 60, 0.4, 'triangle', decay=4)
        sound.noise(0.015, 0.07, 0.25, 1700, release=0.025, decay=4)
        if key == 'land':
            sound.noise(0.02, 0.14, 0.3, 700, decay=3)
    elif key == 'throw':
        sound.noise(0, 0.22, 0.65, 2700, attack=0.035, release=0.075, decay=0.7)
        sound.tone(0.03, 0.15, 450, 1050, 0.10, 'triangle', decay=1)
    elif key == 'magic':
        sound.notes([72, 79, 83, 88], 0.085, 0.34, 0.25, 'pulse')
        sound.noise(0, 0.4, 0.08, 4200, attack=0.025, decay=3)
    elif key in ['bark', 'bark_attack']:
        for start in ([0, 0.20] if key == 'bark' else [0, 0.11, 0.24]):
            sound.bark(start, 0.16 if key == 'bark' else 0.13, low=key == 'bark_attack')
        if key == 'bark_attack':
            sound.noise(0.30, 0.10, 0.22, 1600)
    elif key == 'dog_hurt':
        sound.tone(0, 0.23, 260, 530, 0.3, attack=0.025, decay=0.8)
        sound.tone(0.20, 0.32, 510, 190, 0.28, attack=0.025, release=0.08, decay=1)
    elif key == 'pickup':
        sound.notes([79, 88], 0.075, 0.18, 0.3, 'triangle')
    elif key == 'bell':
        for frequency, volume in [(830, 0.4), (1379, 0.20), (2233, 0.12)]:
            sound.tone(0, 1.10, frequency, volume=volume, attack=0.003, release=0.1, decay=5.5)
    elif key == 'thunder':
        sound.noise(0, 2.15, 1.2, 280, attack=0.04, release=0.6, decay=2)
        sound.noise(0.22, 1.65, 0.45, 900, attack=0.13, release=0.5, decay=2)
        sound.tone(0.05, 1.6, 64, 35, 0.14, attack=0.08, release=0.4, decay=2)
    elif key == 'rain':
        white = [sound.rng.uniform(-1, 1) for _ in sound.samples]
        length = len(white)
        for index in range(length):
            filtered = sum(white[(index - offset) % length] for offset in range(7)) / 7
            modulation = 0.88 + 0.07 * math.sin(TAU * index / length) + 0.05 * math.sin(3 * TAU * index / length)
            sound.samples[index] = filtered * modulation
    elif key == 'egg':
        sound.notes([67, 74, 78, 86], 0.115, 0.30, 0.3, 'triangle')
    elif key == 'victory':
        sound.notes([67, 72, 76, 74, 79, 84], 0.14, 0.45, 0.25, 'pulse')
    elif key == 'typing':
        sound.noise(0, 0.032, 0.3, 2200, attack=0.002, release=0.015, decay=3)
    elif key == 'ui':
        sound.tone(0, 0.06, 980, 1180, 0.18, decay=3)
    elif key == 'checkpoint':
        sound.notes([64, 71, 83], 0.105, 0.30, 0.25, 'triangle')
    elif key == 'paper':
        for start in [0, 0.095, 0.20]:
            sound.noise(start, 0.15, 0.35, 2800, attack=0.025, release=0.06, decay=1)
    elif key == 'door':
        sound.tone(0, 0.47, 190, 83, 0.2, 'pulse', attack=0.04, release=0.08, decay=0.5)
        sound.noise(0, 0.5, 0.18, 950, attack=0.07, decay=1)
        sound.impact(0.49, heavy=True)
    elif key == 'boss_roar':
        for frequency, volume in [(87, 0.4), (174, 0.18), (285, 0.09)]:
            sound.tone(0, 0.85, frequency, frequency*0.68, volume, 'pulse', attack=0.06, release=0.18, decay=0.7)
        sound.noise(0, 0.85, 0.3, 780, attack=0.06, release=0.18, decay=1)
    elif key == 'boss_warn':
        for start in [0, 0.27]:
            sound.tone(start, 0.24, 440, 350, 0.23, 'pulse', attack=0.015)
            sound.tone(start, 0.24, 466, 370, 0.13, attack=0.015)
    elif key == 'boss_enter':
        sound.impact(heavy=True)
        for frequency in [110, 131, 165]:
            sound.tone(0.03, 0.82, frequency, volume=0.2, shape='triangle', attack=0.04, release=0.16, decay=1.5)
    elif key == 'transition':
        sound.noise(0, 0.80, 0.6, 1700, attack=0.14, release=0.22, decay=0.6)
    elif key == 'heal':
        sound.notes([60, 67, 76, 79], 0.11, 0.35, 0.25)
    elif key == 'mp_up':
        sound.notes([69, 76, 83], 0.075, 0.24, 0.25)
    elif key == 'mp_down':
        sound.notes([76, 69, 62], 0.07, 0.22, 0.25, 'triangle')
    else:
        raise ValueError(key)
    return sound


def render(key):
    samples = compose(key).samples
    samples = [sum(samples[(index + offset) % len(samples)] * weight for offset,weight in [(-2,1),(-1,4),(0,6),(1,4),(2,1)]) / 16 for index in range(len(samples))]
    mean = sum(samples) / len(samples)
    samples = [sample - mean for sample in samples]
    if key == 'rain':
        seam = min(range(len(samples)), key=lambda index: abs(samples[index] - samples[index - 1]))
        samples = samples[seam:] + samples[:seam]
    else:
        for index in range(len(samples)):
            fade = min(1, index / (RATE * 0.006), (len(samples)-1-index) / (RATE * 0.018))
            samples[index] *= math.sin(fade * math.pi / 2) ** 2
    peak = max(abs(sample) for sample in samples)
    rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
    target = 0.055 if key in ['typing','ui','footstep'] else 0.12 if key == 'rain' else 0.15
    gain = min(0.78 / peak, target / rms)
    pcm = [round(sample * gain * 32767) for sample in samples]
    payload = struct.pack('<' + 'h' * len(pcm), *pcm)
    output = io.BytesIO()
    with wave.open(output, 'wb') as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(RATE)
        writer.writeframes(payload)
    return output.getvalue(), {
        'sampleCount': len(pcm),
        'peak': round(max(abs(value) for value in pcm) / 32768, 8),
        'rms': round(math.sqrt(sum(value * value for value in pcm) / len(pcm)) / 32768, 8),
        'dcOffset': round(sum(pcm) / len(pcm) / 32768, 8),
        'maxSampleStep': round(max(abs(pcm[index]-pcm[index-1]) for index in range(1,len(pcm))) / 32768, 8),
        'loopSeamStep': round(abs(pcm[0]-pcm[-1]) / 32768, 8),
        'firstSample': pcm[0], 'lastSample': pcm[-1],
        'clippedSamples': sum(abs(value)>=32767 for value in pcm),
    }


def main():
    parser = argparse.ArgumentParser(description='Reproducible original SFX; no external audio input.')
    parser.add_argument('--check', action='store_true', help='Regenerate in memory and compare every WAV and provenance file.')
    parser.add_argument('--output-dir', type=Path, default=ROOT/'game/public/assets/audio')
    parser.add_argument('--report', type=Path)
    arguments = parser.parse_args()
    destination = arguments.output_dir
    license_bytes = (ROOT/'LICENSE').read_bytes()
    files = []
    metrics = {}
    mismatches = []
    for key, (duration, group, description) in RECIPES.items():
        data, analysis = render(key)
        name = f'sfx_{key}.wav'
        path = destination/name
        if arguments.check:
            if not path.is_file() or path.read_bytes()!=data:
                mismatches.append(name)
        else:
            destination.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        if analysis['clippedSamples'] or analysis['peak']>0.781 or abs(analysis['dcOffset'])>0.01 or analysis['loopSeamStep']>0.002 or analysis['maxSampleStep']>0.45:
            raise ValueError(f'Quality limit failed: {key}: {analysis}')
        files.append({'key':key,'file':name,'source':f'procedural:tools/generate_original_sfx.py#{key}','duration':analysis['sampleCount']/RATE,'sampleCount':analysis['sampleCount'],'sourceRate':RATE,'sourceChannels':1,'seed':f'{seed_for(key):016x}','category':group,'recipe':description,'loop':key=='rain','sha256':hashlib.sha256(data).hexdigest()})
        metrics[key] = analysis
    manifest = {
        'generatedBy':'tools/generate_original_sfx.py','generatorVersion':VERSION,
        'generatorSha256':hashlib.sha256(Path(__file__).read_text(encoding='utf-8').encode()).hexdigest(),
        'notes':'All 32 SFX are original procedural waveforms. No external samples, speech or animal recordings are used. Dog vocalizations are synthetic. Existing three BGM scores are unchanged.',
        'license':'MIT','licenseFile':'LICENSE.txt','licenseSha256':hashlib.sha256(license_bytes).hexdigest(),
        'format':'mono / 22050Hz / 16-bit PCM','files':files,
    }
    for name,data in [('manifest.json',(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()),('LICENSE.txt',license_bytes)]:
        path = destination/name
        if arguments.check:
            if not path.is_file() or path.read_bytes()!=data:
                mismatches.append(name)
        else:
            path.write_bytes(data)
    report = {'generatorVersion':VERSION,'mode':'check' if arguments.check else 'generate','files':len(files),'mismatches':mismatches,'metrics':metrics,'limits':{'peak':0.781,'absoluteDcOffset':0.01,'loopSeamStep':0.002,'maxSampleStep':0.45,'clippedSamples':0},'subjectiveListening':'not performed; technical checks do not establish subjective timbre or mix quality'}
    if arguments.report:
        arguments.report.parent.mkdir(parents=True,exist_ok=True)
        arguments.report.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'mode':report['mode'],'files':len(files),'mismatches':mismatches,'peakMax':max(item['peak'] for item in metrics.values()),'maxSeamStep':max(item['loopSeamStep'] for item in metrics.values()),'clippedSamples':sum(item['clippedSamples'] for item in metrics.values())}))
    if mismatches:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
