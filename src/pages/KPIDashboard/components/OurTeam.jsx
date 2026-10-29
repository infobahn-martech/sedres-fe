import React from 'react';
import YellowColorIcon from '../../../assets/images/YellowColorIcon.png';
import BlueColorIcon from '../../../assets/images/BlueColorIcon.png';
import VoilentColorIcon from '../../../assets/images/VoilentColorIcon.png';
import GreenColorIcon from '../../../assets/images/GreenColorIcon.png';
import PurpleColorIcon from '../../../assets/images/PurpleColorIcon.png';
import '../../../design/scss/pages/kpi-dashboard/components/OurTeam.scss';

const OurTeam = () => {
    const teamData = [
        {
            name: 'Tariq Abdulaziz',
            level: 4,
            points: 4520,
            completion: 60,
            icon: PurpleColorIcon,
        },
        {
            name: 'Layla Hassan',
            level: 2,
            points: 2100,
            completion: 10,
            icon: GreenColorIcon,
        },
        {
            name: 'Arjun Mehta',
            level: 3,
            points: 3572,
            completion: 52,
            icon: YellowColorIcon,
        },
        {
            name: 'Priya Nair',
            level: 1,
            points: 1680,
            completion: 65,
            icon: BlueColorIcon,
        },
        {
            name: 'Noor Al-Faisal',
            level: 5,
            points: 5867,
            completion: 25,
            icon: VoilentColorIcon,
        },
        {
            name: 'Yusuf Al-Hassan',
            level: 3,
            points: 3286,
            completion: 40,
            icon: YellowColorIcon,
        },
    ];

    return (
        <div className="kpi-our-team">
            <div className="kpi-our-team__header">
                <h3 className="kpi-our-team__title">Our Team</h3>
            </div>
            <div className="kpi-our-team__table-wrapper">
                <table className="kpi-our-team__table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Level</th>
                            <th>Points</th>
                            <th>Current Level Completion</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teamData.map((member, index) => (
                            <tr key={index}>
                                <td className="kpi-our-team__name">{member.name}</td>
                                <td className="kpi-our-team__level">
                                    <div className="kpi-our-team__level-content">
                                        <img
                                            src={member.icon}
                                            alt={`Level ${member.level}`}
                                            className="kpi-our-team__level-icon"
                                        />
                                        <span>Level {member.level}</span>
                                    </div>
                                </td>
                                <td className="kpi-our-team__points">{member.points.toLocaleString()} Points</td>
                                <td className="kpi-our-team__completion">
                                    <div className="kpi-our-team__progress-bar">
                                        <div
                                            className="kpi-our-team__progress-fill"
                                            style={{ width: `${member.completion}%` }}
                                        ></div>
                                    </div>
                                    <span className="kpi-our-team__completion-text">{member.completion}%</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OurTeam;

